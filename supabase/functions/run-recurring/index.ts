// Supabase Edge Function: run-recurring
//
// Materializes due recurring expenses. Invoked on a schedule by pg_cron (see
// migrations/2026-07-21_recurring_expenses.sql). For every active template whose
// next_run_at has passed, it generates a real expense (+ payers + member splits
// + payment splits + notifications), reconciling against the group's *current*
// membership, then advances the template's schedule. Runs entirely as the
// service role, so it bypasses RLS.
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
async function sendExpoPush(
  admin: SupabaseClient,
  toUserId: string,
  type: string,
  payload: { title: string; body: string; referenceId: string }
) {
  const prefKey = "notif_expense_inclusion";
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
  title: string,
  body: string
) {
  await admin.from("notifications_tbl").insert({
    from_user_id: fromUserId,
    to_user_id: toUserId,
    type: "expense_inclusion",
    reference_id: expenseId
  });
  await sendExpoPush(admin, toUserId, "expense_inclusion", {
    title,
    body,
    referenceId: expenseId
  });
}

// --- occurrence generation -------------------------------------------------
type GenResult = "created" | "draft" | "duplicate";

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
  // draft the creator can finalize, and ping only them.
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
    if (error) return isUniqueViolation(error) ? "duplicate" : Promise.reject(error);
    await notifyAndPush(
      admin,
      t.creator_id,
      t.creator_id,
      expenseId,
      "Recurring expense needs review",
      `"${t.description}" couldn't post automatically — some members left the group. Finalize it to split.`
    );
    return "draft";
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
    return isUniqueViolation(expErr) ? "duplicate" : Promise.reject(expErr);

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
        "New Expense",
        `You've been added to "${t.description}"`
      )
    )
  );

  return "created";
}

Deno.serve(async (req) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("Authorization");
  if (!auth || auth !== `Bearer ${serviceKey}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
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
      const { data: creator } = await admin
        .from("users_tbl")
        .select("plan, plan_expires_at")
        .eq("id", t.creator_id)
        .maybeSingle();
      const isPro =
        creator?.plan === "pro" &&
        (!creator.plan_expires_at ||
          new Date(creator.plan_expires_at) > now);
      if (!isPro) continue;

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

      while (runAt <= now && active && iterations < MAX_CATCHUP) {
        iterations++;
        const result = await generateOccurrence(admin, t, runAt, currentMembers);
        if (result === "created") {
          generated++;
          count++;
        } else if (result === "draft") {
          drafts++;
          count++;
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
    } catch (e) {
      // One bad template must not stop the rest.
      console.error(`Template ${t.id} failed:`, e);
    }
  }

  return new Response(
    JSON.stringify({
      processed: (templates ?? []).length,
      generated,
      drafts
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
