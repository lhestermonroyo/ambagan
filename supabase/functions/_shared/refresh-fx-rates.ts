// Supabase Edge Function: refresh-fx-rates
//
// Refreshes fx_rates_tbl from a public rate feed. Invoked weekly by pg_cron (see
// migrations/2026-08-01_fx_rates.sql). Runs as the service role, so it bypasses
// RLS — the table has no write policy at all, which is what keeps clients from
// ever poisoning it.
//
// These rates drive ONE screen (the book budget card), where they render an
// approximate figure that is always labelled with its `as_of` date. Nothing
// that has to be exact — balances, settlements — ever touches them.
//
// Every run writes a row to fx_refresh_log_tbl, success or failure. Without it
// this fails invisibly: cron.job_run_details only knows whether the SQL ran,
// pg_net prunes the real HTTP status within hours, and the app degrades quietly
// to stale rates. `select max(ran_at) from fx_refresh_log_tbl where ok` is the
// health check.
//
// Deploy:   supabase functions deploy refresh-fx-rates
//           supabase functions deploy refresh-fx-rates-dev
// Secrets:  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (injected by Supabase)
//
// Auth: the cron job calls this with the service role key as the bearer token;
// we additionally require that exact key so the endpoint isn't publicly usable.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { schemaFromRequest } from "./schema.ts";

// ExchangeRate-API's open endpoint: no key, no registration, daily updates, and
// it covers every currency the app offers (including VND and TWD, which the ECB
// reference set — and so frankfurter.app — does not).
const FEED_URL = "https://open.er-api.com/v6/latest/PHP";

// Keep in sync with `currencies` in utils/constants.ts.
const SUPPORTED = [
  "PHP",
  "USD",
  "EUR",
  "JPY",
  "GBP",
  "CNY",
  "KRW",
  "SGD",
  "VND",
  "THB",
  "TWD",
  "MYR",
  "IDR",
  "INR"
];

/**
 * Reject any rate that has moved more than this against the stored value in one
 * refresh. A real weekly move is a fraction of a percent for major pairs, so a
 * jump this large means a broken feed, a re-denomination, or a decimal slip —
 * and writing it would quietly wreck every budget card. The old rate survives
 * and the anomaly is reported in the response for the next run to re-check.
 *
 * Deliberately generous: a genuine currency crisis would trip this and need a
 * manual override, which is the right trade for an approximate display figure.
 */
const MAX_WEEKLY_DRIFT = 0.25;

/** Stored rates older than this are too stale to judge a new rate against. */
const DRIFT_BASELINE_MAX_AGE_MS = 45 * 24 * 60 * 60 * 1000;

/** Log rows older than this are pruned on each run. ~26 rows at weekly. */
const LOG_RETENTION_DAYS = 180;

type RateRow = { currency: string; php_per_unit: number; as_of: string };

type RunOutcome = {
  ok: boolean;
  status:
    | "ok"
    | "fetch_failed"
    | "feed_invalid"
    | "too_many_rejected"
    | "write_failed";
  as_of?: string;
  updated_count?: number;
  rejected?: { currency: string; reason: string }[];
  error?: string;
};

export const handler = async (req: Request): Promise<Response> => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("Authorization");
  if (!auth || auth !== `Bearer ${serviceKey}`) {
    // Deliberately NOT logged: an unauthenticated caller must not be able to
    // write rows to our log table. A misconfigured cron shows up as a missing
    // run — i.e. a stale `max(ran_at)` — which is the check that matters.
    return new Response("Unauthorized", { status: 401 });
  }

  // `<name>-dev` deployment → dev schema; `refresh-fx-rates` → public.
  const schema = schemaFromRequest(req);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, {
    db: { schema }
  });

  /**
   * Record the run, then respond. Every exit path below goes through here so a
   * failure leaves a durable trace — pg_net's response log is pruned within
   * hours and `cron.job_run_details` can't see the HTTP status at all.
   * Best-effort: a failing log write must never mask the actual outcome.
   */
  const finish = async (outcome: RunOutcome, status: number) => {
    try {
      await admin.from("fx_refresh_log_tbl").insert({
        ok: outcome.ok,
        status: outcome.status,
        as_of: outcome.as_of ?? null,
        updated_count: outcome.updated_count ?? null,
        rejected: outcome.rejected ?? null,
        error: outcome.error ?? null
      });
      await admin
        .from("fx_refresh_log_tbl")
        .delete()
        .lt(
          "ran_at",
          new Date(
            Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000
          ).toISOString()
        );
    } catch (e) {
      console.error("Failed to write fx refresh log:", e);
    }
    return json({ schema, ...outcome }, status);
  };

  // --- fetch -------------------------------------------------------------
  let feed: {
    result?: string;
    rates?: Record<string, number>;
    time_last_update_utc?: string;
  };
  try {
    const res = await fetch(FEED_URL);
    if (!res.ok) throw new Error(`feed responded ${res.status}`);
    feed = await res.json();
  } catch (e) {
    // Leave the table exactly as it was. A stale-but-sane rate beats a blank
    // one, and the client's `as_of` caption already discloses the age.
    console.error("FX feed fetch failed:", e);
    return finish({ ok: false, status: "fetch_failed", error: String(e) }, 502);
  }

  if (feed.result === "error" || !feed.rates) {
    console.error("FX feed returned no rates:", feed);
    return finish(
      { ok: false, status: "feed_invalid", error: "feed returned no rates" },
      502
    );
  }

  // The feed is anchored on PHP, so its values are UNITS PER PHP; the table
  // stores PHP PER UNIT. Inverting here keeps the client math trivial.
  const asOf = feedDate(feed.time_last_update_utc);

  const { data: existingRows } = await admin
    .from("fx_rates_tbl")
    .select("currency, php_per_unit, as_of");

  // Only rates that are still FRESH are worth comparing against. If the cron has
  // been down for months every rate has legitimately drifted, and comparing to a
  // stale baseline would reject the whole feed forever — the table could never
  // recover on its own. An old rate is simply overwritten.
  const staleBefore = Date.now() - DRIFT_BASELINE_MAX_AGE_MS;
  const existing = new Map(
    (existingRows ?? [])
      .filter((r: RateRow) => new Date(r.as_of).getTime() >= staleBefore)
      .map((r: RateRow) => [r.currency, Number(r.php_per_unit)])
  );

  // --- validate ----------------------------------------------------------
  const updates: RateRow[] = [];
  const rejected: { currency: string; reason: string }[] = [];

  for (const currency of SUPPORTED) {
    if (currency === "PHP") {
      updates.push({ currency, php_per_unit: 1, as_of: asOf });
      continue;
    }

    const perPhp = Number(feed.rates[currency]);
    if (!Number.isFinite(perPhp) || perPhp <= 0) {
      rejected.push({ currency, reason: "missing or non-positive in feed" });
      continue;
    }

    const phpPerUnit = 1 / perPhp;
    const prev = existing.get(currency);
    if (prev && Math.abs(phpPerUnit - prev) / prev > MAX_WEEKLY_DRIFT) {
      rejected.push({
        currency,
        reason: `moved ${((phpPerUnit / prev - 1) * 100).toFixed(1)}% vs stored ${prev}`
      });
      continue;
    }

    updates.push({ currency, php_per_unit: phpPerUnit, as_of: asOf });
  }

  // A feed that fails validation wholesale is a broken feed, not a market move
  // — write nothing rather than half a table.
  if (updates.length < SUPPORTED.length / 2) {
    console.error("Too many rejected rates, skipping write:", rejected);
    return finish(
      {
        ok: false,
        status: "too_many_rejected",
        error: `only ${updates.length}/${SUPPORTED.length} rates passed validation`,
        rejected
      },
      502
    );
  }

  // --- write -------------------------------------------------------------
  const { error } = await admin
    .from("fx_rates_tbl")
    .upsert(
      updates.map((u) => ({ ...u, updated_at: new Date().toISOString() })),
      { onConflict: "currency" }
    );

  if (error) {
    console.error("Failed to write fx rates:", error);
    return finish(
      { ok: false, status: "write_failed", error: String(error), rejected },
      500
    );
  }

  return finish(
    {
      ok: true,
      status: "ok",
      as_of: asOf,
      updated_count: updates.length,
      rejected
    },
    200
  );
};

/** Feed timestamp → ISO date, falling back to today if it's absent/unparseable. */
function feedDate(raw?: string): string {
  const date = raw ? new Date(raw) : new Date();
  const valid = Number.isNaN(date.getTime()) ? new Date() : date;
  return valid.toISOString().slice(0, 10);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
