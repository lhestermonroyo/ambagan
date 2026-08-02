import { useEffect, useSyncExternalStore } from "react";
import { cacheService } from "./cacheService";
import { tables } from "./constants";
import { supabase } from "./supabase";

/**
 * Indicative FX rates, used ONLY to render mixed-currency spend against a single
 * budget (see BookBudgetCard). Deliberately approximate, with three rules:
 *
 *   * Conversion happens at DISPLAY time only. A stored expense always keeps the
 *     currency and amount it was entered in, so a refreshed rate re-prices every
 *     historical book at once and no migration is ever needed.
 *   * Anything showing a converted figure MUST mark it approximate and cite
 *     {@link FxTable.asOf} — an unlabelled converted number reads as exact.
 *   * Money that must be exact — group balances, settlements, per-currency
 *     totals — is never converted. Those stay split by currency.
 *
 * Rates come from `fx_rates_tbl`, refreshed weekly by the `refresh-fx-rates`
 * Edge Function (pg_cron). The client reads that table, caches it in SQLite so
 * it survives offline, and falls back to {@link FALLBACK} when it has never
 * managed a fetch. Because `asOf` travels with the rates, a dead cron shows up
 * on screen as an ageing date rather than a silently stale number.
 */
export type FxTable = {
  /** PHP per 1 unit of each currency. PHP is the anchor purely because it's the
   *  app default — cross-rates are derived, so any pair works. */
  rates: Record<string, number>;
  /**
   * Publication date PER CURRENCY. Rates don't necessarily refresh together —
   * the refresh function rejects an individual currency whose rate looks broken
   * and keeps its previous value, so one currency can lag the rest. Kept
   * per-currency so a caption can quote the vintage of the rates it actually
   * used rather than the table's best-case date. See {@link fxAsOfFor}.
   */
  asOfByCurrency: Record<string, string>;
  /** OLDEST date in the table — the honest headline vintage when no particular
   *  set of currencies is in question. Never the newest: that would advertise a
   *  freshness some rows don't have. */
  asOf: string;
};

/**
 * Shipped baseline, used until the first successful fetch and on a device that
 * has never been online. Snapshot of the same feed the cron reads, taken
 * 2026-08-01 — it ages from the day it ships, so it's a floor that keeps the
 * budget card working, not a substitute for the refresh.
 */
const FALLBACK_AS_OF = "2026-08-01";

const FALLBACK: FxTable = {
  asOf: FALLBACK_AS_OF,
  // Every baseline rate is from the same snapshot, so they share one date.
  asOfByCurrency: {},
  rates: {
    PHP: 1,
    USD: 61.25,
    EUR: 70.51,
    JPY: 0.3837,
    GBP: 82.44,
    CNY: 9.099,
    KRW: 0.04252,
    SGD: 47.72,
    VND: 0.002333,
    THB: 1.832,
    TWD: 1.898,
    MYR: 14.99,
    IDR: 0.003395,
    INR: 0.6415
  }
};

/**
 * REQUIRED attribution for the rate feed — not optional styling. ExchangeRate-
 * API's free open-access endpoint grants commercial use without an API key on
 * the condition of "attribution on the pages you're using these rates with",
 * linking this URL with this label. They explicitly allow it to be discreet and
 * in keeping with the rest of the app, which is why it rides along in the
 * budget card's caption rather than getting its own row.
 *
 * If the feed in refresh-fx-rates ever changes, this has to change with it.
 */
export const FX_ATTRIBUTION_URL = "https://www.exchangerate-api.com";
export const FX_ATTRIBUTION_LABEL = "Rates By Exchange Rate API";

/** Refetch at most this often — rates only move weekly on the server. */
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

let current: FxTable = FALLBACK;
let lastFetchedAt = 0;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: FxTable): void {
  // Identity change is what drives useSyncExternalStore — always a new object.
  current = next;
  for (const listener of listeners) listener();
}

/**
 * Multiplier taking 1 unit of `from` to units of `to`, or null when either side
 * has no rate — callers must handle null by leaving that money unconverted
 * rather than silently treating it as zero.
 *
 * Takes the table explicitly rather than reading module state, so a component
 * memoizing on it has a dependency React can actually see. Pair with
 * {@link useFxRates}.
 */
export function getRate(
  table: FxTable,
  from: string,
  to: string
): number | null {
  if (from === to) return 1;
  const fromRate = table.rates[from];
  const toRate = table.rates[to];
  if (!fromRate || !toRate) return null;
  return fromRate / toRate;
}

/**
 * Oldest publication date among `currencies` — the only vintage a caption can
 * honestly claim for a figure built from those rates. Currencies don't refresh
 * in lockstep (a rejected rate keeps its previous value), so quoting the
 * table's newest date next to a conversion that used a lagging rate would
 * overstate how current the number is.
 *
 * Falls back to the table-wide `asOf` for any currency with no date of its own,
 * which covers the shipped baseline and caches written by older app versions.
 */
export function fxAsOfFor(table: FxTable, currencies: string[]): string {
  let oldest = "";
  for (const currency of currencies) {
    const asOf = table.asOfByCurrency?.[currency] ?? table.asOf;
    if (!oldest || asOf < oldest) oldest = asOf;
  }
  return oldest || table.asOf;
}

/**
 * "August 2026" — the vintage caption shown beside converted figures. Parsed
 * field-by-field rather than via `new Date(asOf)`, which reads a bare
 * YYYY-MM-DD as UTC midnight and so renders the previous month for anyone west
 * of Greenwich.
 */
export function formatFxAsOf(asOf: string): string {
  const [year, month, day] = asOf.split("-").map(Number);
  if (!year || !month || !day) return asOf;
  return new Date(year, month - 1, day).toLocaleString("en-US", {
    month: "long",
    year: "numeric"
  });
}

/**
 * Load rates, preferring the server table and falling back through the SQLite
 * cache to {@link FALLBACK}. Safe to call on every mount: the result is cached
 * for {@link REFRESH_INTERVAL_MS} and concurrent calls share one request.
 * Never throws — a failed refresh just leaves the previous rates in place,
 * which is the whole point of shipping a baseline.
 */
export async function loadFxRates(): Promise<void> {
  if (inFlight) return inFlight;
  if (Date.now() - lastFetchedAt < REFRESH_INTERVAL_MS) return;

  inFlight = (async () => {
    // Cached rates first so an offline launch still beats the shipped baseline.
    if (current === FALLBACK) {
      const cached = await cacheService.getFxRates().catch(() => null);
      if (cached) publish(cached);
    }

    try {
      const { data, error } = await supabase
        .from(tables.FX_RATES_TBL)
        .select("currency, php_per_unit, as_of");
      if (error) throw error;
      if (!data?.length) return;

      const rates: Record<string, number> = {};
      const asOfByCurrency: Record<string, string> = {};
      let oldest = "";
      for (const row of data as {
        currency: string;
        php_per_unit: number;
        as_of: string;
      }[]) {
        const rate = Number(row.php_per_unit);
        if (!Number.isFinite(rate) || rate <= 0) continue;
        rates[row.currency] = rate;
        asOfByCurrency[row.currency] = row.as_of;
        // Table-wide vintage is the OLDEST row, not the newest — a currency
        // whose refresh keeps getting rejected must not be papered over by the
        // ones that did update. Per-currency dates above let a caption be more
        // precise than this when it knows which rates it used.
        if (!oldest || row.as_of < oldest) oldest = row.as_of;
      }
      if (!rates.PHP || Object.keys(rates).length < 2) return;

      const table = { rates, asOfByCurrency, asOf: oldest || FALLBACK.asOf };
      lastFetchedAt = Date.now();
      publish(table);
      await cacheService.saveFxRates(table).catch(() => {});
    } catch {
      // Offline or the table isn't deployed yet — keep whatever we have.
    }
  })();

  try {
    await inFlight;
  } finally {
    inFlight = null;
  }
}

/**
 * Current rates, re-rendering the caller when a refresh lands. Kicks off the
 * load itself, so a screen only has to use the hook to get live rates.
 */
export function useFxRates(): FxTable {
  const table = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => current
  );
  // Fire-and-forget: resolves into a publish() when it lands, and is a no-op
  // while rates are still fresh.
  useEffect(() => {
    loadFxRates();
  }, []);
  return table;
}
