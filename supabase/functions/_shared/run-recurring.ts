// Supabase Edge Function: run-recurring
//
// Materializes due recurring expenses. Invoked on a schedule by pg_cron (see
// migrations/2026-07-21_recurring_expenses.sql). For every active template whose
// next_run_at has passed, it generates a real expense, then advances the
// template's schedule. Runs entirely as the service role, so it bypasses RLS.
//
// It processes TWO kinds of template in one invocation:
//   * recurring_expenses_tbl (group)    → expenses_tbl (+ payers + member splits
//     + payment splits + notifications), reconciled against the group's *current*
//     membership.
//   * personal_recurring_tbl (book, Pro) → personal_expenses_tbl. Much simpler:
//     a personal expense has no payers/splits/settlements, so it's a single
//     insert per period with no membership reconciliation.
//
// Notifications raised per run:
//   * expense_inclusion — to each group member pulled into a generated expense
//     (one per occurrence; unchanged).
//   * recurring_posted  — to the creator/owner, once per template per run, for
//     BOTH group and book. Aggregated so a long catch-up (up to MAX_CATCHUP
//     periods) can't fire dozens of pushes at the same person.
//   * recurring_review  — to the group creator when an occurrence degrades to a
//     draft. Also aggregated, and never merged with recurring_posted: a run that
//     posts some periods and drafts others sends both, because the draft is the
//     one that needs action.
//
// Deploy:   supabase functions deploy run-recurring
// Secrets:  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (injected by Supabase),
//           EXPO_ACCESS_TOKEN (optional; same as send-push)
//
// Auth: the cron job calls this with the service role key as the bearer token;
// we additionally require that exact key so the endpoint isn't publicly usable.

import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  addDays,
  addMonths,
  addWeeks,
  startOfDay
} from "https://esm.sh/date-fns@4.1.0";
import { schemaFromRequest } from "./schema.ts";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
// Keep in sync with features/expense/utils/recurrence.util.ts.
const GENERATION_HOUR = 8;
// Cap catch-up per template per run so a long-dormant daily series can't spin
// forever; remaining periods are picked up on subsequent ticks.
const MAX_CATCHUP = 60;

// --- date math (mirrors recurrence.util.ts) --------------------------------
function advance(date: Date, frequency: string, interval: number): Date {
  const step = Math.max(1, interval);
  if (frequency === "daily") return addDays(date, step);
  if (frequency === "weekly") return addWeeks(date, step);
  if (frequency === "monthly") return addMonths(date, step);
  return addDays(date, step);
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const isUniqueViolation = (e: any) =>
  e?.code === "23505" || /duplicate key/i.test(e?.message ?? "");

// --- money formatting (port of features/expense/utils/formatAmount.ts) ------
// Kept in sync by hand: an Edge Function is bundled on its own and can't import
// from the app tree. Signs mirror `currencies` in utils/constants.ts.
const CURRENCY_SIGNS: Record<string, string> = {
  PHP: "₱",
  USD: "$",
  EUR: "€",
  JPY: "¥",
  GBP: "£",
  CNY: "¥",
  KRW: "₩",
  SGD: "S$",
  VND: "₫",
  THB: "฿",
  TWD: "NT$",
  MYR: "RM",
  IDR: "Rp",
  INR: "₹"
};

function formatAmount(amount: number, currency: string): string {
  let formatted: string;
  try {
    formatted = new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol"
    }).format(amount);
  } catch {
    // Unknown/invalid code — never let notification copy take down a run.
    return `${currency} ${amount.toFixed(2)}`;
  }
  const sign = CURRENCY_SIGNS[currency];
  if (!sign) return formatted;
  return formatted.replace(/^(-?)[^\d-]*/, (_m, minus) => `${minus}${sign}`);
}

// --- split algorithm (port of features/expense/utils/split.util.ts) --------
function generatePaymentSplits(
  payers: { userId: string; amount: number }[],
  memberSplits: { userId: string; amount: number; percentage: number }[]
): { memberSplitId: string; payerId: string; amount: number }[] {
  const netMap: Record<string, number> = {};
  for (const p of payers) netMap[p.userId] = (netMap[p.userId] || 0) + p.amount;
  for (const s of memberSplits)
    netMap[s.userId] = (netMap[s.userId] || 0) - s.amount;

  const creditors: { userId: string; amount: number }[] = [];
  const debtors: { userId: string; amount: number }[] = [];
  for (const [userId, net] of Object.entries(netMap)) {
    if (net > 0.001) creditors.push({ userId, amount: net });
    else if (net < -0.001) debtors.push({ userId, amount: -net });
  }
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const result: { memberSplitId: string; payerId: string; amount: number }[] =
    [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const pay = Math.min(creditors[ci].amount, debtors[di].amount);
    result.push({
      memberSplitId: debtors[di].userId,
      payerId: creditors[ci].userId,
      amount: round2(pay)
    });
    creditors[ci].amount -= pay;
    debtors[di].amount -= pay;
    if (creditors[ci].amount < 0.001) ci++;
    if (debtors[di].amount < 0.001) di++;
  }
  return result;
}

// Equal split that always sums to the total (remainder to the first member).
function distributeEqual(
  userIds: string[],
  total: number
): { userId: string; amount: number; percentage: number }[] {
  const n = userIds.length;
  if (n === 0) return [];
  const per = Math.floor((total / n) * 100) / 100;
  const pct = round2(100 / n);
  const splits = userIds.map((id) => ({
    userId: id,
    amount: per,
    percentage: pct
  }));
  const remainder = round2(total - per * n);
  if (remainder !== 0) splits[0].amount = round2(splits[0].amount + remainder);
  return splits;
}

// A single/default payer is forced to the total; a multi-payer set must still
// sum after members who left are dropped (else null → draft fallback).
function reconcilePayers(
  validPayers: { userId: string; amount: number }[],
  total: number
): { userId: string; amount: number }[] | null {
  if (validPayers.length === 0) return null;
  if (validPayers.length === 1)
    return [{ userId: validPayers[0].userId, amount: total }];
  const sum = validPayers.reduce((s, p) => s + Number(p.amount), 0);
  if (Math.abs(sum - total) > 0.5) return null;
  return validPayers.map((p) => ({
    userId: p.userId,
    amount: Number(p.amount)
  }));
}

// --- push (port of send-push internals) ------------------------------------
// Same NotificationType -> preference column map as send-push.ts; the generator
// runs as the service role and calls Expo directly rather than round-tripping
// through that function, so the map has to exist in both places.
const NOTIF_PREF_KEY: Record<string, string> = {
  expense_inclusion: "notif_expense_inclusion",
  recurring_posted: "notif_recurring_expense",
  recurring_review: "notif_recurring_expense"
};

async function sendExpoPush(
  admin: SupabaseClient,
  toUserId: string,
  type: string,
  payload: { title: string; body: string; referenceId: string }
) {
  const prefKey = NOTIF_PREF_KEY[type];
  if (!prefKey) return;

  const [{ data: prefs }, { data: tokens }] = await Promise.all([
    admin
      .from("user_preferences_tbl")
      .select(prefKey)
      .eq("user_id", toUserId)
      .maybeSingle(),
    admin.from("user_push_tokens_tbl").select("token").eq("user_id", toUserId)
  ]);

  if (!prefs || !(prefs as Record<string, boolean>)[prefKey]) return;
  if (!tokens || tokens.length === 0) return;

  const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(expoAccessToken ? { Authorization: `Bearer ${expoAccessToken}` } : {})
  };

  const deadTokens: string[] = [];
  await Promise.all(
    tokens.map(async (t: { token: string }) => {
      const message = {
        to: t.token,
        title: payload.title,
        body: payload.body,
        data: { type, referenceId: payload.referenceId },
        sound: "default"
      };
      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers,
          body: JSON.stringify([message])
        });
        const body = await res.json().catch(() => null);
        const ticket = Array.isArray(body?.data) ? body.data[0] : body?.data;
        if (
          ticket?.status === "error" &&
          ticket.details?.error === "DeviceNotRegistered"
        ) {
          deadTokens.push(t.token);
        }
      } catch (e) {
        console.error(JSON.stringify({ fetchError: String(e), token: t.token }));
      }
    })
  );

  if (deadTokens.length > 0) {
    await admin.from("user_push_tokens_tbl").delete().in("token", deadTokens);
  }
}

async function notifyAndPush(
  admin: SupabaseClient,
  fromUserId: string,
  toUserId: string,
  expenseId: string,
  type: string,
  title: string,
  body: string
) {
  await admin.from("notifications_tbl").insert({
    from_user_id: fromUserId,
    to_user_id: toUserId,
    type,
    reference_id: expenseId
  });
  await sendExpoPush(admin, toUserId, type, {
    title,
    body,
    referenceId: expenseId
  });
}

// Recurring notifications are self-addressed (from_user_id === to_user_id): the
// generator acts on the creator's behalf, and notifications_tbl requires a real
// from_user. The app renders these without the usual "<name> did X" prefix —
// see getRecurringMessage in NotificationItem.tsx.
async function notifyRecurring(
  admin: SupabaseClient,
  userId: string,
  expenseId: string,
  type: "recurring_posted" | "recurring_review",
  title: string,
  body: string
) {
  await notifyAndPush(admin, userId, userId, expenseId, type, title, body);
}

// "<desc> (₱500.00) posted to Barkada." / "<desc> posted 3 times to Barkada —
// ₱1,500.00 total." `count` is how many periods this run materialized.
function postedBody(
  description: string,
  container: string,
  amount: number,
  currency: string,
  count: number
): string {
  const label = container ? ` to ${container}` : "";
  if (count === 1) {
    return `"${description}" (${formatAmount(amount, currency)}) posted${label}.`;
  }
  return `"${description}" posted ${count} times${label} — ${formatAmount(
    amount * count,
    currency
  )} total.`;
}

// --- occurrence generation -------------------------------------------------
type GenStatus = "created" | "draft" | "duplicate";
// The id rides along so the caller can aggregate a run's occurrences into one
// creator-facing notification pointing at the most recent expense.
type GenResult = { status: GenStatus; expenseId: string };

async function generateOccurrence(
  admin: SupabaseClient,
  t: any,
  runAt: Date,
  currentMembers: Set<string>
): Promise<GenResult> {
  const expenseId = crypto.randomUUID();
  const total = Number(t.amount);
  const payersSnap: { userId: string; amount: number }[] = t.payers_snapshot ?? [];
  const splitsSnap: { userId: string; amount: number; percentage: number }[] =
    t.splits_snapshot ?? [];

  const validSplits = splitsSnap.filter((s) => currentMembers.has(s.userId));
  const validPayers = payersSnap.filter((p) => currentMembers.has(p.userId));

  let memberSplits: { userId: string; amount: number; percentage: number }[] =
    [];
  let payers: { userId: string; amount: number }[] | null = null;
  let degrade = validSplits.length === 0 || validPayers.length === 0;

  if (!degrade) {
    payers = reconcilePayers(validPayers, total);
    if (!payers) {
      degrade = true;
    } else if (t.split_type === "percentage") {
      const pctSum = validSplits.reduce((s, x) => s + Number(x.percentage), 0);
      if (Math.abs(pctSum - 100) > 0.5) degrade = true;
      else
        memberSplits = validSplits.map((s) => ({
          userId: s.userId,
          percentage: Number(s.percentage),
          amount: round2((total * Number(s.percentage)) / 100)
        }));
    } else if (t.split_type === "custom") {
      const amtSum = validSplits.reduce((s, x) => s + Number(x.amount), 0);
      if (Math.abs(amtSum - total) > 0.5) degrade = true;
      else
        memberSplits = validSplits.map((s) => ({
          userId: s.userId,
          amount: Number(s.amount),
          percentage: total > 0 ? (Number(s.amount) / total) * 100 : 0
        }));
    } else {
      // equal — recompute across the members still in the group
      memberSplits = distributeEqual(
        validSplits.map((s) => s.userId),
        total
      );
    }
  }

  // Need at least two distinct people across payers ∪ split.
  if (!degrade && payers) {
    const involved = new Set<string>([
      ...payers.map((p) => p.userId),
      ...memberSplits.map((m) => m.userId)
    ]);
    if (involved.size < 2) degrade = true;
  }

  // Draft fallback — membership drift made the stored split invalid. Post a
  // draft the creator can finalize; the caller pings only them, once per run.
  if (degrade || !payers) {
    const { error } = await admin.from("expenses_tbl").insert({
      id: expenseId,
      group_id: t.group_id,
      creator_id: t.creator_id,
      amount: total,
      description: t.description,
      split_type: t.split_type || "equal",
      currency: t.currency,
      category: t.category || "other",
      expense_date: runAt.toISOString(),
      is_draft: true,
      recurring_id: t.id
    });
    if (error)
      return isUniqueViolation(error)
        ? { status: "duplicate", expenseId }
        : Promise.reject(error);
    return { status: "draft", expenseId };
  }

  const paymentSplits = generatePaymentSplits(payers, memberSplits);

  const { error: expErr } = await admin.from("expenses_tbl").insert({
    id: expenseId,
    group_id: t.group_id,
    creator_id: t.creator_id,
    amount: total,
    description: t.description,
    split_type: t.split_type,
    currency: t.currency,
    category: t.category || "other",
    expense_date: runAt.toISOString(),
    is_draft: false,
    recurring_id: t.id
  });
  if (expErr)
    return isUniqueViolation(expErr)
      ? { status: "duplicate", expenseId }
      : Promise.reject(expErr);

  const [payersRes, splitsRes, paymentsRes] = await Promise.all([
    admin.from("expense_payers_tbl").insert(
      payers.map((p) => ({
        expense_id: expenseId,
        payer_id: p.userId,
        amount: p.amount
      }))
    ),
    admin.from("member_splits_tbl").insert(
      memberSplits.map((m) => ({
        expense_id: expenseId,
        member_id: m.userId,
        amount: m.amount,
        percentage: m.percentage
      }))
    ),
    admin.from("payment_splits_tbl").insert(
      paymentSplits.map((s) => ({
        group_id: t.group_id,
        expense_id: expenseId,
        member_id: s.memberSplitId,
        payer_id: s.payerId,
        amount: s.amount,
        status: "pending"
      }))
    )
  ]);
  if (payersRes.error) throw payersRes.error;
  if (splitsRes.error) throw splitsRes.error;
  if (paymentsRes.error) throw paymentsRes.error;

  const toNotify = [
    ...new Set<string>(paymentSplits.map((s) => s.memberSplitId))
  ].filter((id) => id !== t.creator_id);
  await Promise.allSettled(
    toNotify.map((id) =>
      notifyAndPush(
        admin,
        t.creator_id,
        id,
        expenseId,
        "expense_inclusion",
        "New Expense",
        `You've been added to "${t.description}"`
      )
    )
  );

  return { status: "created", expenseId };
}

// --- personal occurrence generation ----------------------------------------
// A personal expense has no payers/splits/settlements, so a period is a single
// insert into personal_expenses_tbl. The (recurring_id, expense_date) unique
// index backstops double-posting exactly like the group path.
async function generatePersonalOccurrence(
  admin: SupabaseClient,
  t: any,
  runAt: Date
): Promise<GenResult> {
  const expenseId = crypto.randomUUID();
  const { error } = await admin.from("personal_expenses_tbl").insert({
    id: expenseId,
    book_id: t.book_id,
    user_id: t.user_id,
    amount: Number(t.amount),
    description: t.description,
    category: t.category || "general",
    currency: t.currency,
    expense_date: runAt.toISOString(),
    recurring_id: t.id
  });
  if (error)
    return isUniqueViolation(error)
      ? { status: "duplicate", expenseId }
      : Promise.reject(error);
  return { status: "created", expenseId };
}

// Active-Pro check (mirrors is_user_pro / the group loop's guard). Lapsed
// creators are skipped, not deleted, so a series resumes once Pro is active
// again.
async function isCreatorPro(
  admin: SupabaseClient,
  userId: string,
  now: Date
): Promise<boolean> {
  const { data: user } = await admin
    .from("users_tbl")
    .select("plan, plan_expires_at")
    .eq("id", userId)
    .maybeSingle();
  return (
    user?.plan === "pro" &&
    (!user.plan_expires_at || new Date(user.plan_expires_at) > now)
  );
}

// Advance a due personal template through every period it owes, generating an
// occurrence per period, and persist its new schedule state. Returns how many
// occurrences were created for the run tally.
async function processPersonalTemplate(
  admin: SupabaseClient,
  t: any,
  now: Date
): Promise<number> {
  let created = 0;
  // Newest generated expense — what the owner's notification points at.
  let lastExpenseId: string | null = null;
  let runAt = new Date(t.next_run_at);
  let count: number = t.occurrences_count;
  let active = true;
  let iterations = 0;

  while (runAt <= now && active && iterations < MAX_CATCHUP) {
    iterations++;
    const result = await generatePersonalOccurrence(admin, t, runAt);
    if (result.status === "created") {
      created++;
      count++;
      lastExpenseId = result.expenseId;
    }
    // "duplicate" → already generated for this period; still advance.

    runAt = advance(runAt, t.frequency, t.repeat_interval);

    if (
      t.end_type === "on_date" &&
      t.end_date &&
      startOfDay(runAt) > startOfDay(new Date(t.end_date))
    ) {
      active = false;
    }
    if (
      t.end_type === "after_count" &&
      t.occurrence_limit != null &&
      count >= t.occurrence_limit
    ) {
      active = false;
    }
  }

  await admin
    .from("personal_recurring_tbl")
    .update({
      next_run_at: runAt.toISOString(),
      last_run_at: now.toISOString(),
      occurrences_count: count,
      is_active: active
    })
    .eq("id", t.id);

  // A book has no other members, so this is the only signal the owner gets that
  // money moved. Best-effort: the expenses are already committed, and a push
  // failure must not look like a generation failure.
  if (created > 0 && lastExpenseId) {
    const { data: book } = await admin
      .from("personal_books_tbl")
      .select("name")
      .eq("id", t.book_id)
      .maybeSingle();

    try {
      await notifyRecurring(
        admin,
        t.user_id,
        lastExpenseId,
        "recurring_posted",
        "Recurring expense posted",
        postedBody(
          t.description,
          (book as { name?: string } | null)?.name ?? "",
          Number(t.amount),
          t.currency,
          created
        )
      );
    } catch (e) {
      console.error(`Personal notify failed for template ${t.id}:`, e);
    }
  }

  return created;
}

export const handler = async (req: Request): Promise<Response> => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("Authorization");
  if (!auth || auth !== `Bearer ${serviceKey}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // `<name>-dev` deployment → dev schema; `run-recurring` → public.
  const schema = schemaFromRequest(req);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, {
    db: { schema }
  });
  const now = new Date();

  const { data: templates, error } = await admin
    .from("recurring_expenses_tbl")
    .select("*")
    .eq("is_active", true)
    .lte("next_run_at", now.toISOString());

  if (error) {
    console.error("Failed to load due templates:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500
    });
  }

  let generated = 0;
  let drafts = 0;

  for (const t of templates ?? []) {
    try {
      // Pro guard — skip (don't delete) templates whose creator lapsed; they
      // resume automatically once Pro is active again.
      if (!(await isCreatorPro(admin, t.creator_id, now))) continue;

      const { data: memberRows } = await admin
        .from("group_members_tbl")
        .select("member_id")
        .eq("group_id", t.group_id);
      const currentMembers = new Set(
        (memberRows ?? []).map((r: { member_id: string }) => r.member_id)
      );

      let runAt = new Date(t.next_run_at);
      let count: number = t.occurrences_count;
      let active = true;
      let iterations = 0;
      // Per-template tallies for the creator's one notification per run.
      let createdHere = 0;
      let draftedHere = 0;
      let lastCreatedId: string | null = null;
      let lastDraftId: string | null = null;

      while (runAt <= now && active && iterations < MAX_CATCHUP) {
        iterations++;
        const result = await generateOccurrence(admin, t, runAt, currentMembers);
        if (result.status === "created") {
          generated++;
          count++;
          createdHere++;
          lastCreatedId = result.expenseId;
        } else if (result.status === "draft") {
          drafts++;
          count++;
          draftedHere++;
          lastDraftId = result.expenseId;
        }
        // "duplicate" → already generated for this period; still advance.

        runAt = advance(runAt, t.frequency, t.repeat_interval);

        if (
          t.end_type === "on_date" &&
          t.end_date &&
          startOfDay(runAt) > startOfDay(new Date(t.end_date))
        ) {
          active = false;
        }
        if (
          t.end_type === "after_count" &&
          t.occurrence_limit != null &&
          count >= t.occurrence_limit
        ) {
          active = false;
        }
      }

      await admin
        .from("recurring_expenses_tbl")
        .update({
          next_run_at: runAt.toISOString(),
          last_run_at: now.toISOString(),
          occurrences_count: count,
          is_active: active
        })
        .eq("id", t.id);

      // Tell the creator what their series did. Members already got their own
      // expense_inclusion per occurrence; this is the only message the creator
      // gets, and the only one at all when they're the sole payer.
      if (createdHere > 0 || draftedHere > 0) {
        const { data: group } = await admin
          .from("groups_tbl")
          .select("name")
          .eq("id", t.group_id)
          .maybeSingle();
        const groupName = (group as { name?: string } | null)?.name ?? "";

        // Best-effort: the expenses are committed either way, so a push failure
        // must not fall into the catch below and read as a template failure.
        try {
          if (createdHere > 0 && lastCreatedId) {
            await notifyRecurring(
              admin,
              t.creator_id,
              lastCreatedId,
              "recurring_posted",
              "Recurring expense posted",
              postedBody(
                t.description,
                groupName,
                Number(t.amount),
                t.currency,
                createdHere
              )
            );
          }
          if (draftedHere > 0 && lastDraftId) {
            await notifyRecurring(
              admin,
              t.creator_id,
              lastDraftId,
              "recurring_review",
              "Recurring expense needs review",
              draftedHere === 1
                ? `"${t.description}" couldn't post automatically — some members left the group. Finalize it to split.`
                : `"${t.description}" posted ${draftedHere} drafts — some members left the group. Finalize them to split.`
            );
          }
        } catch (e) {
          console.error(`Notify failed for template ${t.id}:`, e);
        }
      }
    } catch (e) {
      // One bad template must not stop the rest.
      console.error(`Template ${t.id} failed:`, e);
    }
  }

  // --- personal (book) recurring — Pro-only, one insert per period ----------
  const { data: personalTemplates, error: personalErr } = await admin
    .from("personal_recurring_tbl")
    .select("*")
    .eq("is_active", true)
    .lte("next_run_at", now.toISOString());

  if (personalErr) {
    console.error("Failed to load due personal templates:", personalErr);
  }

  let personalGenerated = 0;

  for (const t of personalTemplates ?? []) {
    try {
      // Pro guard — skip (don't delete) lapsed creators; resumes on re-subscribe.
      if (!(await isCreatorPro(admin, t.user_id, now))) continue;
      personalGenerated += await processPersonalTemplate(admin, t, now);
    } catch (e) {
      // One bad template must not stop the rest.
      console.error(`Personal template ${t.id} failed:`, e);
    }
  }

  return new Response(
    JSON.stringify({
      processed: (templates ?? []).length,
      generated,
      drafts,
      personalProcessed: (personalTemplates ?? []).length,
      personalGenerated
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
