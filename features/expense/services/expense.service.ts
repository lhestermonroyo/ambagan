import { createNotification } from "@/features/notifications/services/notification.service";
import states from "@/states";
import {
  Expense,
  ExpensePayer,
  ExpensePreview,
  MemberSplit,
  Payment,
  PaymentExportRow,
  PaymentPreview,
  RecurrenceConfig,
  RecurringExpense,
  ScanResult
} from "@/types/expenses";
import { NotificationType } from "@/types/notifications";
import { cacheService } from "@/utils/cacheService";
import { splitTypes, tables } from "@/utils/constants";
import { computeInitialNextRunAt } from "@/features/expense/utils/recurrence.util";
import * as offlineQueue from "@/utils/offlineQueue";
import { sendPushNotification } from "@/utils/sendPushNotifications";
import { supabase } from "@/utils/supabase";
import { getCompressedReceiptBase64, uploadFile } from "@/utils/upload";
import { ImagePickerAsset, ImagePickerSuccessResult } from "expo-image-picker";
import { v4 as uuid } from "uuid";

/**
 * Scan Receipt (Beta): compress the picked photo, send it to the scan-receipt
 * Edge Function, and return the parsed amount/description/currency/etc. The AI
 * vendor lives behind the Edge Function — this just speaks the normalized
 * contract. Throws on a transport failure so the caller can toast + fall back.
 */
export const scanReceipt = async (uri: string): Promise<ScanResult> => {
  const imageBase64 = await getCompressedReceiptBase64(uri);

  const { data, error } = await supabase.functions.invoke("scan-receipt", {
    body: { imageBase64, mimeType: "image/jpeg" }
  });

  if (error) throw error;

  return data as ScanResult;
};

const GHOST_USER = {
  id: "",
  email: "",
  phone: "",
  first_name: "Deleted",
  last_name: "User",
  avatar: null as string | null
};

const resolveUser = (raw: any) => {
  const user = Array.isArray(raw) ? raw[0] : raw;
  return user ?? GHOST_USER;
};

export const getDailyExpenseCount = async (userId: string): Promise<number> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Count creation *events*, not surviving rows. The expense_creation_log_tbl is
  // append-only (written by an AFTER INSERT trigger on expenses_tbl and never
  // touched on delete), so deleting an expense can't refund the daily slot.
  const { count, error } = await supabase
    .from(tables.EXPENSE_CREATION_LOG_TBL)
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", today.toISOString());

  if (error) throw error;
  return count ?? 0;
};

/**
 * Whether an expense row exists, without throwing on not-found (unlike
 * `getExpenseById`, which uses `.single()`). Used as an idempotency guard when
 * retrying a queued offline create: a pinned-id row that already committed must
 * not be re-inserted. Throws only on a real error (e.g. offline) so the caller
 * can retry safely.
 */
export const expenseExists = async (id: string): Promise<boolean> => {
  const { count, error } = await supabase
    .from(tables.EXPENSES_TBL)
    .select("id", { count: "exact", head: true })
    .eq("id", id);

  if (error) throw error;
  return (count ?? 0) > 0;
};

/**
 * Upload a locally-stashed receipt image and attach it to an already-created
 * expense. Used by the offline sync to re-upload a proof that couldn't be sent
 * while offline, once the expense row itself exists. Kept separate from the
 * insert path so a failed/missing image never blocks the expense from syncing.
 */
export const attachExpenseProof = async (
  expenseId: string,
  proof: { uri: string; fileName: string | null }
): Promise<void> => {
  const uploadResponse = await uploadFile(
    { uri: proof.uri, fileName: proof.fileName } as ImagePickerAsset,
    "receipts"
  );

  if (uploadResponse.error) {
    throw new Error(uploadResponse.message ?? "Receipt upload failed");
  }

  const proofUrl = uploadResponse.data?.publicUrl;
  if (!proofUrl) return;

  const { error } = await supabase
    .from(tables.EXPENSES_TBL)
    .update({ proof_of_payment: proofUrl })
    .eq("id", expenseId);

  if (error) throw error;
};

export const saveExpense = async (
  expensePayload: {
    amount: number;
    description: string;
    proof_of_payment: ImagePickerSuccessResult | null;
    group_id: string;
    split_type: (typeof splitTypes)[number]["value"];
    currency: string;
    /** Spending category; defaults to "other" when omitted. */
    category?: string;
    expense_date?: Date;
    /** Optional pre-generated id — used so offline-queued expenses keep a stable id on sync. */
    id?: string;
    /** Set when this expense is materialized from a recurring series. */
    recurring_id?: string | null;
  },
  payers: { userId: string; amount: number }[],
  memberSplits: { userId: string; amount: number; percentage: number }[],
  paymentSplits: { memberSplitId: string; payerId: string; amount: number }[]
) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const expenseId = expensePayload.id ?? uuid();
  let proofUrl: string | null = null;

  const {
    amount,
    description,
    proof_of_payment,
    group_id,
    split_type,
    currency,
    category,
    expense_date,
    recurring_id
  } = expensePayload;

  if (proof_of_payment) {
    const uploadResponse = await uploadFile(
      proof_of_payment.assets[0],
      "receipts"
    );

    if (uploadResponse.error) throw uploadResponse.error;

    proofUrl = uploadResponse.data?.publicUrl || null;
  }

  const expenseResponse = await supabase.from(tables.EXPENSES_TBL).insert([
    {
      id: expenseId,
      group_id: group_id,
      creator_id: user.data.user.id,
      amount,
      description,
      proof_of_payment: proofUrl,
      split_type,
      currency: currency || "PHP",
      category: category || "other",
      expense_date: expense_date
        ? expense_date.toISOString()
        : new Date().toISOString(),
      recurring_id: recurring_id ?? null
    }
  ]);

  if (expenseResponse.error) {
    throw expenseResponse.error;
  }

  const [payersResponse, splitsResponse, paymentsResponse] = await Promise.all([
    supabase.from(tables.EXPENSE_PAYERS_TBL).insert(
      payers.map((payer) => ({
        expense_id: expenseId,
        payer_id: payer.userId,
        amount: payer.amount
      }))
    ),
    supabase.from(tables.MEMBER_SPLITS_TBL).insert(
      memberSplits.map((split) => ({
        expense_id: expenseId,
        member_id: split.userId,
        amount: split.amount,
        percentage: split.percentage
      }))
    ),
    supabase.from(tables.PAYMENT_SPLITS_TBL).insert(
      paymentSplits.map((split) => ({
        group_id: group_id,
        expense_id: expenseId,
        member_id: split.memberSplitId,
        payer_id: split.payerId,
        amount: split.amount,
        status: "pending"
      }))
    )
  ]);

  if (payersResponse.error) {
    throw payersResponse.error;
  }

  if (splitsResponse.error) {
    throw splitsResponse.error;
  }

  if (paymentsResponse.error) {
    throw paymentsResponse.error;
  }

  const membersToNotify = paymentSplits
    .map((s) => s.memberSplitId)
    .filter(
      (id, idx, arr) => id !== user.data.user!.id && arr.indexOf(id) === idx
    );

  await Promise.allSettled(
    membersToNotify.map((memberId) =>
      Promise.all([
        createNotification({
          fromUserId: user.data.user!.id,
          toUserId: memberId,
          type: NotificationType.EXPENSE_INCLUSION,
          referenceId: expenseId
        }),
        sendPushNotification(memberId, NotificationType.EXPENSE_INCLUSION, {
          title: "New Expense",
          body: `You've been added to "${description}"`,
          referenceId: expenseId
        })
      ])
    )
  );

  return { success: true, message: "Expense created successfully" };
};

/**
 * "Log now, split later." Creates a draft expense — just amount + description
 * (+ optional date/currency/proof). No payers, member splits, or payment
 * splits, and no notifications, so it stays invisible to balances/settlements
 * and to other members until `finalizeDraft` is called.
 */
export const saveDraftExpense = async (expensePayload: {
  amount: number;
  description: string;
  proof_of_payment: ImagePickerSuccessResult | null;
  group_id: string;
  currency: string;
  /** Spending category; defaults to "other" when omitted. */
  category?: string;
  expense_date?: Date;
  /** Optional pre-generated id — keeps an offline-queued draft's id stable on sync. */
  id?: string;
}) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const expenseId = expensePayload.id ?? uuid();
  const {
    amount,
    description,
    proof_of_payment,
    group_id,
    currency,
    category,
    expense_date
  } = expensePayload;

  let proofUrl: string | null = null;
  if (proof_of_payment) {
    const uploadResponse = await uploadFile(
      proof_of_payment.assets[0],
      "receipts"
    );

    if (uploadResponse.error) throw uploadResponse.error;

    proofUrl = uploadResponse.data?.publicUrl || null;
  }

  const expenseResponse = await supabase.from(tables.EXPENSES_TBL).insert([
    {
      id: expenseId,
      group_id,
      creator_id: user.data.user.id,
      amount,
      description,
      proof_of_payment: proofUrl,
      // Placeholder until finalize sets the real split type (column is NOT NULL).
      split_type: "equal",
      currency: currency || "PHP",
      category: category || "other",
      expense_date: expense_date
        ? expense_date.toISOString()
        : new Date().toISOString(),
      is_draft: true
    }
  ]);

  if (expenseResponse.error) {
    throw expenseResponse.error;
  }

  return { success: true, id: expenseId };
};

// =====================================================================
// Recurring expenses (Pro)
//
// A recurring expense is a template + schedule stored in recurring_expenses_tbl.
// The run-recurring Edge Function (invoked by pg_cron) materializes occurrences
// server-side. The client only creates/edits/pauses/deletes the template; the
// one exception is the *first* occurrence, generated inline at creation time so
// the user sees it immediately (below).
// =====================================================================

const RECURRING_SELECT = `id, created_at, updated_at, group_id, amount, description, currency, category, split_type, payers_snapshot, splits_snapshot, frequency, repeat_interval, start_date, end_type, end_date, occurrence_limit, occurrences_count, next_run_at, last_run_at, is_active, creator:creator_id(id, email, phone, first_name, last_name, avatar)`;

/**
 * Create a recurring-expense template. If the series starts today or earlier,
 * the first occurrence is generated immediately (reusing `saveExpense`, so it
 * posts payers/splits/payments + notifications exactly like a manual expense)
 * and the schedule is advanced one step; a future start date just parks the
 * template for the generator to pick up.
 *
 * `payers`/`memberSplits`/`paymentSplits` are the already-resolved arrays the
 * Add Expense form builds — the same ones passed to `saveExpense`. They're
 * stored as JSONB snapshots on the template and reused for the first occurrence.
 */
export const saveRecurringExpense = async (
  templatePayload: {
    group_id: string;
    amount: number;
    description: string;
    currency: string;
    /** Spending category; defaults to "other" when omitted. */
    category?: string;
    split_type: (typeof splitTypes)[number]["value"];
    recurrence: RecurrenceConfig;
    proof_of_payment?: ImagePickerSuccessResult | null;
  },
  payers: { userId: string; amount: number }[],
  memberSplits: { userId: string; amount: number; percentage: number }[],
  paymentSplits: { memberSplitId: string; payerId: string; amount: number }[]
) => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const {
    group_id,
    amount,
    description,
    currency,
    category,
    split_type,
    recurrence
  } = templatePayload;

  const startsToday =
    new Date(recurrence.start_date).setHours(0, 0, 0, 0) <=
    new Date().setHours(0, 0, 0, 0);
  const nextRunAt = computeInitialNextRunAt(recurrence);

  const recurringId = uuid();
  const { error } = await supabase.from(tables.RECURRING_EXPENSES_TBL).insert([
    {
      id: recurringId,
      group_id,
      creator_id: user.data.user.id,
      amount,
      description,
      currency: currency || "PHP",
      category: category || "other",
      split_type,
      payers_snapshot: payers,
      splits_snapshot: memberSplits,
      frequency: recurrence.frequency,
      repeat_interval: recurrence.repeat_interval,
      start_date: recurrence.start_date.toISOString().slice(0, 10),
      end_type: recurrence.end_type,
      end_date: recurrence.end_date
        ? recurrence.end_date.toISOString().slice(0, 10)
        : null,
      occurrence_limit: recurrence.occurrence_limit,
      // The inline first occurrence (if any) counts as the first run.
      occurrences_count: startsToday ? 1 : 0,
      next_run_at: nextRunAt.toISOString(),
      last_run_at: startsToday ? new Date().toISOString() : null,
      is_active: true
    }
  ]);

  if (error) throw error;

  // Materialize the first occurrence now so it lands in the group immediately
  // and starts affecting balances. Future runs are the generator's job.
  if (startsToday) {
    await saveExpense(
      {
        amount,
        description,
        group_id,
        proof_of_payment: templatePayload.proof_of_payment ?? null,
        split_type,
        currency,
        category: category || "other",
        expense_date: new Date(recurrence.start_date),
        recurring_id: recurringId
      },
      payers,
      memberSplits,
      paymentSplits
    );
  }

  return { success: true, id: recurringId };
};

/** A single recurring template by id (for the details screen). */
export const getRecurringById = async (
  recurringId: string
): Promise<RecurringExpense | null> => {
  const { data, error } = await supabase
    .from(tables.RECURRING_EXPENSES_TBL)
    .select(RECURRING_SELECT)
    .eq("id", recurringId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    ...data,
    creator: resolveUser((data as any).creator)
  } as unknown as RecurringExpense;
};

/** All recurring templates for a group (active + paused), newest first. */
export const getRecurringByGroupId = async (
  groupId: string
): Promise<RecurringExpense[]> => {
  const { data, error } = await supabase
    .from(tables.RECURRING_EXPENSES_TBL)
    .select(RECURRING_SELECT)
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((item) => ({
    ...item,
    creator: resolveUser(item.creator)
  })) as unknown as RecurringExpense[];
};

/**
 * Edit a recurring template. Only future occurrences are affected — occurrences
 * already generated are independent expenses and are left untouched. Editing the
 * schedule fields is the caller's responsibility to recompute `next_run_at`.
 */
export const updateRecurringExpense = async (
  recurringId: string,
  patch: Partial<{
    amount: number;
    description: string;
    currency: string;
    split_type: (typeof splitTypes)[number]["value"];
    payers_snapshot: { userId: string; amount: number }[];
    splits_snapshot: {
      userId: string;
      amount: number;
      percentage: number;
    }[];
    frequency: string;
    repeat_interval: number;
    start_date: string;
    end_type: string;
    end_date: string | null;
    occurrence_limit: number | null;
    next_run_at: string;
  }>
) => {
  const { error } = await supabase
    .from(tables.RECURRING_EXPENSES_TBL)
    .update(patch)
    .eq("id", recurringId);

  if (error) throw error;
  return { success: true };
};

/** Pause (is_active=false) or resume a recurring series. */
export const setRecurringActive = async (
  recurringId: string,
  isActive: boolean
) => {
  const { error } = await supabase
    .from(tables.RECURRING_EXPENSES_TBL)
    .update({ is_active: isActive })
    .eq("id", recurringId);

  if (error) throw error;
  return { success: true };
};

/**
 * Delete a recurring series. Future generation stops; occurrences already
 * posted survive (their `recurring_id` FK is ON DELETE SET NULL).
 */
export const deleteRecurringExpense = async (recurringId: string) => {
  const { error } = await supabase
    .from(tables.RECURRING_EXPENSES_TBL)
    .delete()
    .eq("id", recurringId);

  if (error) throw error;
  return { success: true };
};

/**
 * Thrown by `updateExpense` when the expense already has settlements in
 * progress (any payment split that is not "pending"). Editing in that state
 * would silently discard settlement history, so we block it instead.
 */
export const SETTLEMENT_IN_PROGRESS = "SETTLEMENT_IN_PROGRESS";

export const updateExpense = async (
  expenseId: string,
  expensePayload: {
    amount: number;
    description: string;
    /** New picked image, an existing public URL to keep, or null to clear. */
    proof_of_payment: ImagePickerSuccessResult | string | null;
    group_id: string;
    split_type: (typeof splitTypes)[number]["value"];
    currency: string;
    /** Spending category; left unchanged when omitted. */
    category?: string;
    expense_date?: Date;
  },
  payers: { userId: string; amount: number }[],
  memberSplits: { userId: string; amount: number; percentage: number }[],
  paymentSplits: { memberSplitId: string; payerId: string; amount: number }[]
) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  // Authorization — only the creator may edit.
  const existing = await supabase
    .from(tables.EXPENSES_TBL)
    .select("creator_id")
    .eq("id", expenseId)
    .single();

  if (existing.error) {
    throw existing.error;
  }

  if (existing.data?.creator_id !== user.data.user.id) {
    throw new Error("User not authorized to edit this expense");
  }

  // Guard — editing is only safe while every settlement is still pending.
  const splitsCheck = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select("status")
    .eq("expense_id", expenseId);

  if (splitsCheck.error) {
    throw splitsCheck.error;
  }

  const hasProgress = (splitsCheck.data ?? []).some(
    (s) => s.status !== "pending"
  );

  if (hasProgress) {
    throw new Error(SETTLEMENT_IN_PROGRESS);
  }

  const {
    amount,
    description,
    proof_of_payment,
    group_id,
    split_type,
    currency,
    category,
    expense_date
  } = expensePayload;

  // Resolve proof: keep existing url (string), upload a new pick, or clear.
  let proofUrl: string | null = null;
  if (typeof proof_of_payment === "string") {
    proofUrl = proof_of_payment;
  } else if (proof_of_payment) {
    const uploadResponse = await uploadFile(
      proof_of_payment.assets[0],
      "receipts"
    );

    if (uploadResponse.error) throw uploadResponse.error;

    proofUrl = uploadResponse.data?.publicUrl || null;
  }

  const updatePayload: Record<string, any> = {
    amount,
    description,
    proof_of_payment: proofUrl,
    split_type,
    currency: currency || "PHP"
  };
  if (category) {
    updatePayload.category = category;
  }
  if (expense_date) {
    updatePayload.expense_date = expense_date.toISOString();
  }

  const updateResponse = await supabase
    .from(tables.EXPENSES_TBL)
    .update(updatePayload)
    .eq("id", expenseId);

  if (updateResponse.error) {
    throw updateResponse.error;
  }

  // Replace payers / member splits / payment splits wholesale — everything was
  // still pending, so there's no settlement state to preserve.
  const clearResponses = await Promise.all([
    supabase
      .from(tables.EXPENSE_PAYERS_TBL)
      .delete()
      .eq("expense_id", expenseId),
    supabase
      .from(tables.MEMBER_SPLITS_TBL)
      .delete()
      .eq("expense_id", expenseId),
    supabase
      .from(tables.PAYMENT_SPLITS_TBL)
      .delete()
      .eq("expense_id", expenseId)
  ]);

  for (const response of clearResponses) {
    if (response.error) {
      throw response.error;
    }
  }

  const [payersResponse, splitsResponse, paymentsResponse] = await Promise.all([
    supabase.from(tables.EXPENSE_PAYERS_TBL).insert(
      payers.map((payer) => ({
        expense_id: expenseId,
        payer_id: payer.userId,
        amount: payer.amount
      }))
    ),
    supabase.from(tables.MEMBER_SPLITS_TBL).insert(
      memberSplits.map((split) => ({
        expense_id: expenseId,
        member_id: split.userId,
        amount: split.amount,
        percentage: split.percentage
      }))
    ),
    supabase.from(tables.PAYMENT_SPLITS_TBL).insert(
      paymentSplits.map((split) => ({
        group_id: group_id,
        expense_id: expenseId,
        member_id: split.memberSplitId,
        payer_id: split.payerId,
        amount: split.amount,
        status: "pending"
      }))
    )
  ]);

  if (payersResponse.error) {
    throw payersResponse.error;
  }

  if (splitsResponse.error) {
    throw splitsResponse.error;
  }

  if (paymentsResponse.error) {
    throw paymentsResponse.error;
  }

  return { success: true, message: "Expense updated successfully" };
};

/**
 * Convert a draft into a real expense: write its payers / member splits /
 * payment splits, flip `is_draft` → false, and notify the included members.
 * Mirrors the second half of `saveExpense`. No settlement guard is needed
 * because a draft never has payment splits yet.
 */
export const finalizeDraft = async (
  expenseId: string,
  expensePayload: {
    amount: number;
    description: string;
    /** New picked image, an existing public URL to keep, or null to clear. */
    proof_of_payment: ImagePickerSuccessResult | string | null;
    group_id: string;
    split_type: (typeof splitTypes)[number]["value"];
    currency: string;
    /** Spending category; left unchanged when omitted. */
    category?: string;
    expense_date?: Date;
  },
  payers: { userId: string; amount: number }[],
  memberSplits: { userId: string; amount: number; percentage: number }[],
  paymentSplits: { memberSplitId: string; payerId: string; amount: number }[]
) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  // Authorization — only the creator may finalize.
  const existing = await supabase
    .from(tables.EXPENSES_TBL)
    .select("creator_id")
    .eq("id", expenseId)
    .single();

  if (existing.error) {
    throw existing.error;
  }

  if (existing.data?.creator_id !== user.data.user.id) {
    throw new Error("User not authorized to finalize this expense");
  }

  const {
    amount,
    description,
    proof_of_payment,
    group_id,
    split_type,
    currency,
    category,
    expense_date
  } = expensePayload;

  // Resolve proof: keep existing url (string), upload a new pick, or clear.
  let proofUrl: string | null = null;
  if (typeof proof_of_payment === "string") {
    proofUrl = proof_of_payment;
  } else if (proof_of_payment) {
    const uploadResponse = await uploadFile(
      proof_of_payment.assets[0],
      "receipts"
    );

    if (uploadResponse.error) throw uploadResponse.error;

    proofUrl = uploadResponse.data?.publicUrl || null;
  }

  const updatePayload: Record<string, any> = {
    amount,
    description,
    proof_of_payment: proofUrl,
    split_type,
    currency: currency || "PHP",
    is_draft: false
  };
  if (category) {
    updatePayload.category = category;
  }
  if (expense_date) {
    updatePayload.expense_date = expense_date.toISOString();
  }

  const updateResponse = await supabase
    .from(tables.EXPENSES_TBL)
    .update(updatePayload)
    .eq("id", expenseId);

  if (updateResponse.error) {
    throw updateResponse.error;
  }

  // A draft has no children yet, but delete-then-insert keeps finalize
  // idempotent if a previous attempt partially wrote rows.
  const clearResponses = await Promise.all([
    supabase
      .from(tables.EXPENSE_PAYERS_TBL)
      .delete()
      .eq("expense_id", expenseId),
    supabase
      .from(tables.MEMBER_SPLITS_TBL)
      .delete()
      .eq("expense_id", expenseId),
    supabase
      .from(tables.PAYMENT_SPLITS_TBL)
      .delete()
      .eq("expense_id", expenseId)
  ]);

  for (const response of clearResponses) {
    if (response.error) {
      throw response.error;
    }
  }

  const [payersResponse, splitsResponse, paymentsResponse] = await Promise.all([
    supabase.from(tables.EXPENSE_PAYERS_TBL).insert(
      payers.map((payer) => ({
        expense_id: expenseId,
        payer_id: payer.userId,
        amount: payer.amount
      }))
    ),
    supabase.from(tables.MEMBER_SPLITS_TBL).insert(
      memberSplits.map((split) => ({
        expense_id: expenseId,
        member_id: split.userId,
        amount: split.amount,
        percentage: split.percentage
      }))
    ),
    supabase.from(tables.PAYMENT_SPLITS_TBL).insert(
      paymentSplits.map((split) => ({
        group_id: group_id,
        expense_id: expenseId,
        member_id: split.memberSplitId,
        payer_id: split.payerId,
        amount: split.amount,
        status: "pending"
      }))
    )
  ]);

  if (payersResponse.error) {
    throw payersResponse.error;
  }

  if (splitsResponse.error) {
    throw splitsResponse.error;
  }

  if (paymentsResponse.error) {
    throw paymentsResponse.error;
  }

  const membersToNotify = paymentSplits
    .map((s) => s.memberSplitId)
    .filter(
      (id, idx, arr) => id !== user.data.user!.id && arr.indexOf(id) === idx
    );

  await Promise.allSettled(
    membersToNotify.map((memberId) =>
      Promise.all([
        createNotification({
          fromUserId: user.data.user!.id,
          toUserId: memberId,
          type: NotificationType.EXPENSE_INCLUSION,
          referenceId: expenseId
        }),
        sendPushNotification(memberId, NotificationType.EXPENSE_INCLUSION, {
          title: "New Expense",
          body: `You've been added to "${description}"`,
          referenceId: expenseId
        })
      ])
    )
  );

  return { success: true, message: "Draft finalized successfully" };
};

export const deleteExpense = async (expenseId: string, groupId?: string) => {
  // Offline → queue the delete (or, if the expense is a still-pending offline
  // create, drop that create entirely) + optimistic removal. Returns the same
  // success shape so callers behave identically.
  if (!(await offlineQueue.isOnline())) {
    const resolvedGroupId =
      groupId ??
      states.group.getState().expenseList.find((e) => e.id === expenseId)
        ?.group_id;
    if (resolvedGroupId) {
      await offlineQueue.queueDeleteExpense(resolvedGroupId, expenseId);
      return {
        success: true,
        message: "Expense will be deleted when you're back online"
      };
    }
    // No group context to update optimistically — fall through and let it fail.
  }

  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const expenseResponse = await supabase
    .from(tables.EXPENSES_TBL)
    .select("creator_id")
    .eq("id", expenseId)
    .single();

  if (expenseResponse.error) {
    throw expenseResponse.error;
  }

  if (expenseResponse.data?.creator_id !== user.data.user.id) {
    throw new Error("User not authorized to delete this expense");
  }

  const responses = await Promise.all([
    supabase
      .from(tables.EXPENSE_PAYERS_TBL)
      .delete()
      .eq("expense_id", expenseId),
    supabase
      .from(tables.MEMBER_SPLITS_TBL)
      .delete()
      .eq("expense_id", expenseId),
    supabase
      .from(tables.PAYMENT_SPLITS_TBL)
      .delete()
      .eq("expense_id", expenseId)
  ]);

  for (const response of responses) {
    if (response.error) {
      throw response.error;
    }
  }

  const expenseDeleteResponse = await supabase
    .from(tables.EXPENSES_TBL)
    .delete()
    .eq("id", expenseId);

  if (expenseDeleteResponse.error) {
    throw expenseDeleteResponse.error;
  }

  return { success: true, message: "Expense deleted successfully" };
};

export const getPaymentsByUserId = async (
  userId: string,
  page: number = 0,
  limit: number = 10,
  withMetadata: boolean = false,
  filters?: {
    role?: "collects" | "pays";
    status?: "pending" | "requested" | "settled";
  }
) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  // Only the unfiltered first page powers the offline "recent activity" feed.
  const canCache =
    page === 0 && !withMetadata && !filters?.role && !filters?.status;

  const from = page * limit;
  const to = from + limit - 1;

  const normalize = (data: any[]) =>
    data.map((item) => {
      const expense = Array.isArray(item.expense)
        ? item.expense[0]
        : item.expense;
      return {
        ...item,
        member: resolveUser(item.member),
        payer: resolveUser(item.payer),
        expense_description: expense?.description ?? null,
        currency: expense?.currency ?? "PHP",
        expense: undefined
      };
    });

  try {
    let query = supabase
      .from(tables.PAYMENT_SPLITS_TBL)
      .select(
        `id, created_at, group_id, expense_id, member:member_id(id, email, phone, first_name, last_name, avatar), payer:payer_id(id, email, phone, first_name, last_name, avatar), amount, status, proof_of_payment, member_note, payer_note, status_updated_at, requested_at, settled_at, rejected_at, expense:expense_id(description, currency)`,
        { count: withMetadata ? "exact" : undefined }
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    if (filters?.role === "collects") {
      query = query.eq("payer_id", userId);
    } else if (filters?.role === "pays") {
      query = query.eq("member_id", userId);
    } else {
      query = query.or(`member_id.eq.${userId},payer_id.eq.${userId}`);
    }

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }

    const expenseSplitResponse = await query;

    if (expenseSplitResponse.error) {
      throw expenseSplitResponse.error;
    }

    if (withMetadata) {
      const totalCount = expenseSplitResponse.count || 0;
      const totalPages = Math.ceil(totalCount / limit);
      const hasNext = page < totalPages - 1;
      const hasPrevious = page > 0;

      return {
        data: normalize(expenseSplitResponse.data) as PaymentPreview[],
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNext,
          hasPrevious
        }
      };
    }

    const result = {
      data: normalize(expenseSplitResponse.data) as PaymentPreview[]
    };

    if (canCache) {
      cacheService.savePayments(userId, result.data).catch(() => {});
    }

    return result;
  } catch (error) {
    if (canCache) {
      const cached = await cacheService.getPayments(userId);
      if (cached) {
        return { data: cached as PaymentPreview[] };
      }
    }
    throw error;
  }
};

export const getPaymentsByExpenseId = async (expenseId: string) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const paymentListResponse = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select(
      `*, member:member_id(id, email, phone, first_name, last_name, avatar), payer:payer_id(id, email, phone, first_name, last_name, avatar), expense:expense_id(currency)`
    )
    .eq("expense_id", expenseId)
    .order("created_at", { ascending: false });

  if (paymentListResponse.error) {
    throw paymentListResponse.error;
  }

  return paymentListResponse.data.map((item) => {
    const expense = Array.isArray(item.expense)
      ? item.expense[0]
      : item.expense;
    return {
      ...item,
      member: resolveUser(item.member),
      payer: resolveUser(item.payer),
      currency: expense?.currency ?? "PHP",
      expense: undefined
    };
  }) as Payment[];
};

export const getStatsByUserId = async (userId: string) => {
  const groupByCurrency = (data: { amount: number; expense: any }[]) => {
    const map: Record<string, number> = {};
    data.forEach((item) => {
      const expense = Array.isArray(item.expense)
        ? item.expense[0]
        : item.expense;
      const currency = expense?.currency ?? "PHP";
      map[currency] = (map[currency] ?? 0) + item.amount;
    });
    return Object.entries(map).map(([currency, amount]) => ({
      currency,
      amount
    }));
  };

  try {
    const user = await supabase.auth.getUser();

    if (!user.data.user) {
      throw new Error("User not authenticated");
    }

    const toPayResponse = await supabase
      .from(tables.PAYMENT_SPLITS_TBL)
      .select("amount, expense:expense_id(currency)")
      .eq("member_id", userId)
      .or(`status.eq.pending,status.eq.requested`);

    if (toPayResponse.error) {
      throw toPayResponse.error;
    }

    const toReceiveResponse = await supabase
      .from(tables.PAYMENT_SPLITS_TBL)
      .select("amount, expense:expense_id(currency)")
      .eq("payer_id", userId)
      .or(`status.eq.pending,status.eq.requested`);

    if (toReceiveResponse.error) {
      throw toReceiveResponse.error;
    }

    const result = {
      toPay: groupByCurrency(toPayResponse.data ?? []),
      toReceive: groupByCurrency(toReceiveResponse.data ?? [])
    };

    cacheService.saveStats(userId, result).catch(() => {});

    return result;
  } catch (error) {
    const cached = await cacheService.getStats(userId);
    if (cached) {
      return cached as {
        toPay: { currency: string; amount: number }[];
        toReceive: { currency: string; amount: number }[];
      };
    }
    throw error;
  }
};

export const getExpensesByGroupId = async (groupId: string) => {
  const { data, error } = await supabase
    .from(tables.EXPENSES_TBL)
    .select(
      `id, created_at, group_id, amount, description, status, is_draft, currency, category, expense_date, split_type, proof_of_payment, creator:creator_id(id, email, phone, first_name, last_name, avatar)`
    )
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  // Batch-fetch payment split statuses for every expense in the group so the
  // list can gate editing the same way the detail screen does (a split past
  // "pending" makes the expense uneditable). One query instead of N.
  const expenseIds = data.map((item) => item.id);
  const progressByExpenseId = new Set<string>();

  if (expenseIds.length) {
    const { data: splitData } = await supabase
      .from(tables.PAYMENT_SPLITS_TBL)
      .select("expense_id, status")
      .in("expense_id", expenseIds);

    (splitData ?? []).forEach((split) => {
      if (split.status !== "pending") {
        progressByExpenseId.add(split.expense_id);
      }
    });
  }

  const expenseList = await Promise.all(
    data.map(async (item) => {
      const has_settlement_progress = progressByExpenseId.has(item.id);

      try {
        const payerData = await getPayersByExpenseId(item.id);

        return {
          ...item,
          creator: resolveUser(item.creator),
          payer_list: payerData,
          has_settlement_progress
        };
      } catch (error) {
        return {
          ...item,
          creator: resolveUser(item.creator),
          payer_list: [],
          has_settlement_progress
        };
      }
    })
  );

  return expenseList as unknown as ExpensePreview[];
};

export const getExpenseById = async (id: string) => {
  const { data, error } = await supabase
    .from(tables.EXPENSES_TBL)
    .select(
      `*, creator:creator_id(id, email, phone, first_name, last_name, avatar)`
    )
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return data as Expense;
};

export const getPayersByExpenseId = async (expenseId: string) => {
  const { data, error } = await supabase
    .from(tables.EXPENSE_PAYERS_TBL)
    .select(
      "*, payer:payer_id(id, email, phone, first_name, last_name, avatar, is_placeholder), expense:expense_id(currency)"
    )
    .eq("expense_id", expenseId);

  if (error) {
    throw error;
  }

  return data.map((item) => {
    const expense = Array.isArray(item.expense)
      ? item.expense[0]
      : item.expense;
    return {
      ...item,
      payer: resolveUser(item.payer),
      currency: expense?.currency ?? "PHP",
      expense: undefined
    };
  }) as ExpensePayer[];
};

export const getMemberSplitsByExpenseId = async (expenseId: string) => {
  const { data, error } = await supabase
    .from(tables.MEMBER_SPLITS_TBL)
    .select(
      `*, member:member_id(id, email, phone, first_name, last_name, avatar, is_placeholder), expense:expense_id(currency)`
    )
    .eq("expense_id", expenseId);

  if (error) {
    throw error;
  }

  return data.map((item) => {
    const expense = Array.isArray(item.expense)
      ? item.expense[0]
      : item.expense;
    return {
      ...item,
      member: resolveUser(item.member),
      currency: expense?.currency ?? "PHP",
      expense: undefined
    };
  }) as MemberSplit[];
};

export const getMemberSplitsByExpenseIds = async (
  expenseIds: string[]
): Promise<MemberSplit[]> => {
  if (expenseIds.length === 0) return [];
  const { data, error } = await supabase
    .from(tables.MEMBER_SPLITS_TBL)
    .select(
      `*, member:member_id(id, email, phone, first_name, last_name, avatar, is_placeholder), expense:expense_id(currency)`
    )
    .in("expense_id", expenseIds);

  if (error) throw error;

  return data.map((item) => {
    const expense = Array.isArray(item.expense)
      ? item.expense[0]
      : item.expense;
    return {
      ...item,
      member: resolveUser(item.member),
      currency: expense?.currency ?? "PHP",
      expense: undefined
    };
  }) as MemberSplit[];
};

export const getPaymentsByExpenseIds = async (
  expenseIds: string[]
): Promise<Payment[]> => {
  if (expenseIds.length === 0) return [];
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select(
      `*, member:member_id(id, email, phone, first_name, last_name, avatar), payer:payer_id(id, email, phone, first_name, last_name, avatar), expense:expense_id(currency)`
    )
    .in("expense_id", expenseIds)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data.map((item) => {
    const expense = Array.isArray(item.expense)
      ? item.expense[0]
      : item.expense;
    return {
      ...item,
      member: resolveUser(item.member),
      payer: resolveUser(item.payer),
      currency: expense?.currency ?? "PHP",
      expense: undefined
    };
  }) as Payment[];
};

export const getSplitsByExpense = async (expenseId: string) => {
  const { data, error } = await supabase
    .from(tables.MEMBER_SPLITS_TBL)
    .select(`*, member:user_id(id, email, first_name, last_name, avatar)`)
    .eq("expense_id", expenseId);

  if (error) {
    throw error;
  }

  return data;
};

export const createSettledRequest = async (expensePayload: {
  note: string;
  receipt: ImagePickerSuccessResult | null;
  expenseSplitId: string;
}) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }
  const { note, receipt, expenseSplitId } = expensePayload;
  let receiptUrl: string | null = null;

  if (receipt) {
    const uploadResponse = await uploadFile(receipt.assets[0], "receipts");

    if (uploadResponse.error) throw uploadResponse.error;

    receiptUrl = uploadResponse.data?.publicUrl || null;
  }

  const now = new Date().toISOString();
  const splitResponse = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .update({
      status: "requested",
      member_note: note,
      proof_of_payment: receiptUrl,
      requested_at: now,
      status_updated_at: now
      // rejected_at is intentionally left intact — if a prior request was
      // rejected, keep that date so the rejection stays visible as history.
    })
    .eq("id", expenseSplitId)
    .select("payer_id")
    .single();

  if (splitResponse.error) {
    throw splitResponse.error;
  }

  try {
    await Promise.all([
      createNotification({
        fromUserId: user.data.user.id,
        toUserId: splitResponse.data.payer_id,
        type: NotificationType.SETTLEMENT_REQUEST,
        referenceId: expenseSplitId
      }),
      sendPushNotification(
        splitResponse.data.payer_id,
        NotificationType.SETTLEMENT_REQUEST,
        {
          title: "Settlement Requested",
          body: "Someone is requesting to settle a payment with you",
          referenceId: expenseSplitId
        }
      )
    ]);
  } catch (err) {
    console.error("Failed to send payment request notification:", err);
  }

  return { success: true, message: "Request created successfully" };
};

export const undoSettledRequest = async (expenseSplitId: string) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const splitResponse = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .update({
      status: "pending",
      member_note: null,
      proof_of_payment: null,
      // Request withdrawn — drop the request date.
      requested_at: null,
      status_updated_at: new Date().toISOString()
    })
    .eq("id", expenseSplitId);

  if (splitResponse.error) {
    throw splitResponse.error;
  }

  return { success: true, message: "Settled request undone successfully" };
};

export const rejectSettledRequest = async (expenseSplitId: string) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const rejectedNow = new Date().toISOString();
  const splitResponse = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .update({
      status: "pending",
      member_note: null,
      proof_of_payment: null,
      // Persist when the request was rejected (kept even though status reverts to
      // pending) so the rejection date can be surfaced. requested_at is left in
      // place so both "requested" and "rejected" dates remain visible.
      rejected_at: rejectedNow,
      status_updated_at: rejectedNow
    })
    .eq("id", expenseSplitId)
    .select("member_id")
    .single();

  if (splitResponse.error) {
    throw splitResponse.error;
  }

  try {
    await Promise.all([
      createNotification({
        fromUserId: user.data.user.id,
        toUserId: splitResponse.data.member_id,
        type: NotificationType.SETTLEMENT_REJECTED,
        referenceId: expenseSplitId
      }),
      sendPushNotification(
        splitResponse.data.member_id,
        NotificationType.SETTLEMENT_REJECTED,
        {
          title: "Settlement Rejected",
          body: "Your settlement request has been rejected",
          referenceId: expenseSplitId
        }
      )
    ]);
  } catch (err) {
    console.error("Failed to send payment rejected notification:", err);
  }

  return { success: true, message: "Settled request rejected successfully" };
};

export const revertSettledRequest = async (expenseSplitId: string) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const revertedNow = new Date().toISOString();
  const splitResponse = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .update({
      status: "requested",
      // Reopened for review — it's a pending request again, so restore a request
      // date and clear the settled date.
      requested_at: revertedNow,
      settled_at: null,
      status_updated_at: revertedNow
    })
    .eq("id", expenseSplitId)
    .select("member_id")
    .single();

  if (splitResponse.error) {
    throw splitResponse.error;
  }

  try {
    await Promise.all([
      createNotification({
        fromUserId: user.data.user.id,
        toUserId: splitResponse.data.member_id,
        type: NotificationType.SETTLEMENT_REVERTED,
        referenceId: expenseSplitId
      }),
      sendPushNotification(
        splitResponse.data.member_id,
        NotificationType.SETTLEMENT_REVERTED,
        {
          title: "Settlement Reopened",
          body: "Your settlement has been reopened for review",
          referenceId: expenseSplitId
        }
      )
    ]);
  } catch (err) {
    console.error("Failed to send settlement reverted notification:", err);
  }

  return { success: true, message: "Settled request reverted successfully" };
};

export const markAsSettled = async (expensePayload: {
  note: string;
  receipt: ImagePickerSuccessResult | null;
  expenseSplitId: string;
  expenseId: string;
}) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }
  const { note, receipt, expenseSplitId, expenseId } = expensePayload;
  let receiptUrl: string | null = null;

  if (receipt) {
    const uploadResponse = await uploadFile(receipt.assets[0], "receipts");

    if (uploadResponse.error) throw uploadResponse.error;

    receiptUrl = uploadResponse.data?.publicUrl || null;
  }

  // Only overwrite proof_of_payment when the payer actually attaches a new
  // receipt. Approving a member's request comes through here with receipt=null,
  // and blindly writing null would wipe the proof the member uploaded when they
  // created the settlement request.
  const settledNow = new Date().toISOString();
  const updatePayload: Record<string, any> = {
    status: "settled",
    payer_note: note,
    settled_at: settledNow,
    status_updated_at: settledNow
  };
  if (receiptUrl) {
    updatePayload.proof_of_payment = receiptUrl;
  }

  const splitResponse = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .update(updatePayload)
    .eq("id", expenseSplitId)
    .select("member_id")
    .single();

  if (splitResponse.error) {
    throw splitResponse.error;
  }

  try {
    await Promise.all([
      createNotification({
        fromUserId: user.data.user.id,
        toUserId: splitResponse.data.member_id,
        type: NotificationType.SETTLEMENT_APPROVED,
        referenceId: expenseSplitId
      }),
      sendPushNotification(
        splitResponse.data.member_id,
        NotificationType.SETTLEMENT_APPROVED,
        {
          title: "Settlement Approved",
          body: "Your settlement request has been approved",
          referenceId: expenseSplitId
        }
      )
    ]);
  } catch (err) {
    console.error("Failed to send payment approved notification:", err);
  }

  const { data: allSplits, error: splitsError } = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select("status")
    .eq("expense_id", expenseId);

  if (splitsError) throw splitsError;

  const allSettled =
    allSplits.length > 0 && allSplits.every((s) => s.status === "settled");

  if (allSettled) {
    const { error: expenseError } = await supabase
      .from(tables.EXPENSES_TBL)
      .update({ status: "completed" })
      .eq("id", expenseId);

    if (expenseError) throw expenseError;
  }

  return { success: true, message: "Marked as settled successfully" };
};

const PAYMENT_FIELDS = `*, member:member_id(id, email, phone, first_name, last_name, avatar, is_placeholder), payer:payer_id(id, email, phone, first_name, last_name, avatar, is_placeholder), expense:expense_id(description, currency)`;

// Export needs the parent expense's category + own date on top of the standard
// payment fields so each CSV row is self-describing (see getPaymentsForExport).
const PAYMENT_EXPORT_FIELDS = `*, member:member_id(id, email, phone, first_name, last_name, avatar, is_placeholder), payer:payer_id(id, email, phone, first_name, last_name, avatar, is_placeholder), expense:expense_id(description, currency, category, expense_date)`;

const mapPaymentRows = (data: any[]): Payment[] =>
  data.map((item) => {
    const expense = Array.isArray(item.expense)
      ? item.expense[0]
      : item.expense;
    return {
      ...item,
      expense_description: expense?.description ?? null,
      currency: expense?.currency ?? "PHP",
      member: resolveUser(item.member),
      payer: resolveUser(item.payer),
      expense: undefined
    };
  }) as Payment[];

const mapPaymentExportRows = (data: any[]): PaymentExportRow[] =>
  data.map((item) => {
    const expense = Array.isArray(item.expense)
      ? item.expense[0]
      : item.expense;
    return {
      ...item,
      expense_description: expense?.description ?? null,
      currency: expense?.currency ?? "PHP",
      expense_category: expense?.category ?? "other",
      expense_date: expense?.expense_date ?? null,
      member: resolveUser(item.member),
      payer: resolveUser(item.payer),
      expense: undefined
    };
  }) as PaymentExportRow[];

export const getPaymentsByGroupAndUserId = async (
  groupId: string,
  userId: string
) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select(PAYMENT_FIELDS)
    .eq("group_id", groupId)
    .or(`member_id.eq.${userId},payer_id.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return mapPaymentRows(data);
};

/**
 * Fetch a single payment split as a full `Payment` (incl. proof_of_payment and
 * notes). Used to hydrate a `PaymentPreview` — which omits those fields — before
 * opening a settlement sheet that needs them.
 */
export const getPaymentById = async (
  paymentId: string
): Promise<Payment | null> => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select(PAYMENT_FIELDS)
    .eq("id", paymentId)
    .single();

  if (error) throw error;
  return data ? mapPaymentRows([data])[0] : null;
};

export const getUnsettledPaymentsByGroupId = async (
  groupId: string
): Promise<Payment[]> => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select(PAYMENT_FIELDS)
    .eq("group_id", groupId)
    .in("status", ["pending", "requested"])
    .order("created_at", { ascending: false });

  if (error) throw error;
  return mapPaymentRows(data);
};

export const getActivePaymentsByGroupAndUserId = async (
  groupId: string,
  userId: string
): Promise<Payment[]> => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select(PAYMENT_FIELDS)
    .eq("group_id", groupId)
    .or(`member_id.eq.${userId},payer_id.eq.${userId}`)
    .in("status", ["pending", "requested"])
    .order("created_at", { ascending: false });

  if (error) throw error;
  return mapPaymentRows(data);
};

export const getUnsettledPaymentsByUserId = async (
  userId: string
): Promise<Payment[]> => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select(PAYMENT_FIELDS)
    .or(`member_id.eq.${userId},payer_id.eq.${userId}`)
    .in("status", ["pending", "requested"])
    .order("created_at", { ascending: false });

  if (error) throw error;
  return mapPaymentRows(data);
};

const SETTLED_PAGE_SIZE = 20;

export const getSettledPaymentsByGroupAndUserId = async (
  groupId: string,
  userId: string,
  options: { cutoff?: Date | null; page?: number } = {}
): Promise<{ data: Payment[]; hasNext: boolean }> => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { cutoff = null, page = 0 } = options;
  const from = page * SETTLED_PAGE_SIZE;
  const to = from + SETTLED_PAGE_SIZE - 1;

  let query = supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select(PAYMENT_FIELDS, { count: "exact" })
    .eq("group_id", groupId)
    .or(`member_id.eq.${userId},payer_id.eq.${userId}`)
    .eq("status", "settled")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (cutoff) {
    query = query.gte("created_at", cutoff.toISOString());
  }

  const { data, error, count } = await query;
  if (error) throw error;

  const totalPages = Math.ceil((count || 0) / SETTLED_PAGE_SIZE);
  return { data: mapPaymentRows(data), hasNext: page < totalPages - 1 };
};

export const getPaymentsForExport = async (
  groupId: string,
  userId: string,
  cutoff: Date | null
): Promise<PaymentExportRow[]> => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  let query = supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select(PAYMENT_EXPORT_FIELDS)
    .eq("group_id", groupId)
    .or(`member_id.eq.${userId},payer_id.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (cutoff) {
    query = query.gte("created_at", cutoff.toISOString());
  }

  const { data, error } = await query;
  if (error) throw error;
  return mapPaymentExportRows(data);
};

export const getUnpaidPayments = async (groupId: string, userId: string) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const response = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select(`id`)
    .eq("group_id", groupId)
    .or(`member_id.eq.${userId},payer_id.eq.${userId}`)
    .or(`status.eq.pending,status.eq.requested`);

  if (response.error) {
    throw response.error;
  }

  return (response.data?.length || 0) > 0;
};
