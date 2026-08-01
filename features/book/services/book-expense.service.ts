import {
  PersonalBookTotal,
  PersonalExpense,
  PersonalExpenseStatus
} from "@/types/books";
import { cacheService } from "@/utils/cacheService";
import { tables } from "@/utils/constants";
import { isUniqueViolation, supabase } from "@/utils/supabase";
import { uploadFile } from "@/utils/upload";
import { ImagePickerAsset, ImagePickerSuccessResult } from "expo-image-picker";
import "react-native-get-random-values";
import { v4 as uuid } from "uuid";

// NOTE (slice #3): ONLINE paths only. Offline queueing + optimistic cache land
// in slice #5 (mirroring offlineQueue's expense flow). The free-tier daily limit
// is checked here against the server log; the offline-aware resolver (cached
// count + queued-today) is added in slice #5 too.

const EXPENSE_SELECT = `id, created_at, book_id, user_id, amount, description, category, currency, expense_date, proof_of_payment, recurring_id, status`;

export const savePersonalExpense = async (payload: {
  book_id: string;
  user_id: string;
  amount: number;
  description: string;
  category?: string;
  currency: string;
  expense_date?: Date;
  proof_of_payment: ImagePickerSuccessResult | null;
  /** Settled ('paid', the default) or an upcoming/unpaid bill ('pending'). */
  status?: PersonalExpenseStatus;
  /** Optional pre-generated id — used so offline-queued expenses keep a stable id on sync. */
  id?: string;
  /** Set when this expense is materialized from a personal recurring series. */
  recurring_id?: string | null;
}) => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  if (payload.user_id !== user.data.user.id) {
    throw new Error("Expense owner must be the authenticated user");
  }

  const expenseId = payload.id ?? uuid();
  let proofUrl: string | null = null;

  if (payload.proof_of_payment) {
    const uploadResponse = await uploadFile(
      payload.proof_of_payment.assets[0],
      "receipts"
    );
    if (uploadResponse.error) throw uploadResponse.error;
    proofUrl = uploadResponse.data?.publicUrl || null;
  }

  // The AFTER INSERT trigger writes personal_expense_creation_log_tbl (the 5/day
  // meter). A unique-violation retry (offline sync) is an idempotent no-op — the
  // row already exists, and the log was already written on the first commit.
  const { error } = await supabase.from(tables.PERSONAL_EXPENSES_TBL).insert([
    {
      id: expenseId,
      book_id: payload.book_id,
      user_id: payload.user_id,
      amount: payload.amount,
      description: payload.description,
      category: payload.category || "general",
      currency: payload.currency || "PHP",
      expense_date: (payload.expense_date ?? new Date()).toISOString(),
      proof_of_payment: proofUrl,
      status: payload.status ?? "paid",
      recurring_id: payload.recurring_id ?? null
    }
  ]);

  if (error && !isUniqueViolation(error)) throw error;

  return { message: "Expense added successfully", data: { expenseId } };
};

export const updatePersonalExpense = async (
  expenseId: string,
  payload: {
    amount: number;
    description: string;
    category?: string;
    currency: string;
    expense_date?: Date;
    /** A newly picked receipt image to upload, if any. */
    proof_of_payment: ImagePickerSuccessResult | null;
    /** The existing receipt URL to keep when no new image is picked. */
    existing_proof_url: string | null;
    /** Settled ('paid') or an upcoming/unpaid bill ('pending'). */
    status?: PersonalExpenseStatus;
  }
) => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  let proofUrl: string | null = payload.existing_proof_url;

  if (payload.proof_of_payment) {
    const uploadResponse = await uploadFile(
      payload.proof_of_payment.assets[0],
      "receipts"
    );
    if (uploadResponse.error) throw uploadResponse.error;
    proofUrl = uploadResponse.data?.publicUrl || null;
  }

  // Owner-only RLS keeps this scoped to the current user's own expense.
  const { error } = await supabase
    .from(tables.PERSONAL_EXPENSES_TBL)
    .update({
      amount: payload.amount,
      description: payload.description,
      category: payload.category || "general",
      currency: payload.currency || "PHP",
      expense_date: (payload.expense_date ?? new Date()).toISOString(),
      proof_of_payment: proofUrl,
      // Only overwrite status when the caller passes one, so an edit that
      // doesn't touch it leaves the stored value alone.
      ...(payload.status ? { status: payload.status } : {})
    })
    .eq("id", expenseId)
    .eq("user_id", user.data.user.id);

  if (error) throw error;

  return { message: "Expense updated successfully" };
};

/**
 * Flip just the paid/pending flag on one expense — the lightweight write behind
 * the inline status toggle on the book detail list. Owner-only RLS scopes it to
 * the current user's own expense.
 */
export const setPersonalExpenseStatus = async (
  expenseId: string,
  status: PersonalExpenseStatus
) => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from(tables.PERSONAL_EXPENSES_TBL)
    .update({ status })
    .eq("id", expenseId)
    .eq("user_id", user.data.user.id);

  if (error) throw error;

  return { message: "Expense status updated" };
};

/**
 * Upload a locally-stashed receipt and attach it to an already-created/updated
 * personal expense. Used by the offline sync to re-upload a proof that couldn't
 * be sent while offline, once the expense row itself exists. Best-effort — kept
 * separate so a failed image never blocks the expense from syncing.
 */
export const attachPersonalExpenseProof = async (
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
    .from(tables.PERSONAL_EXPENSES_TBL)
    .update({ proof_of_payment: proofUrl })
    .eq("id", expenseId);

  if (error) throw error;
};

export const deletePersonalExpense = async (expenseId: string) => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from(tables.PERSONAL_EXPENSES_TBL)
    .delete()
    .eq("id", expenseId)
    .eq("user_id", user.data.user.id);

  if (error) throw error;

  return { success: true, message: "Expense deleted successfully" };
};

export const getPersonalExpenseById = async (
  expenseId: string
): Promise<PersonalExpense> => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from(tables.PERSONAL_EXPENSES_TBL)
    .select(EXPENSE_SELECT)
    .eq("id", expenseId)
    .single();

  if (error) throw error;
  return data as PersonalExpense;
};

const EXPENSES_PAGE_SIZE = 15;

export const getPersonalExpensesByBookId = async (
  bookId: string,
  page: number = 0,
  limit: number = EXPENSES_PAGE_SIZE
): Promise<{ data: PersonalExpense[]; hasNext: boolean }> => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const from = page * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabase
    .from(tables.PERSONAL_EXPENSES_TBL)
    .select(EXPENSE_SELECT, { count: "exact" })
    .eq("book_id", bookId)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  const totalPages = Math.ceil((count || 0) / limit);

  return {
    data: (data as PersonalExpense[]) ?? [],
    hasNext: page < totalPages - 1
  };
};

/**
 * Every personal expense in a book, unpaginated — feeds the Stats tab, which
 * needs the whole ledger (not just a page) to compute totals, top expenses, and
 * the category breakdown. Books are personal and small, so a single fetch is
 * fine. Falls back to the cached detail snapshot when offline.
 */
export const getAllPersonalExpensesByBookId = async (
  bookId: string
): Promise<PersonalExpense[]> => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  try {
    const { data, error } = await supabase
      .from(tables.PERSONAL_EXPENSES_TBL)
      .select(EXPENSE_SELECT)
      .eq("book_id", bookId)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data as PersonalExpense[]) ?? [];
  } catch (error) {
    const cached = await cacheService.getBookDetail(bookId).catch(() => null);
    if (cached) return cached.expenseList;
    throw error;
  }
};

/**
 * Total spent in a book, broken down per currency (an expense keeps its own
 * currency, so a trip book can mix PHP + JPY) AND per status — `paid` vs
 * `pending`. Summed client-side — books are personal and small. Currencies
 * aren't converted against each other; each is reported on its own entry, the
 * same way the group Net Balance shows per-currency amounts. Sorted by combined
 * (paid + pending) amount descending.
 */
export const getPersonalBookTotals = async (
  bookId: string
): Promise<PersonalBookTotal[]> => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from(tables.PERSONAL_EXPENSES_TBL)
    .select("amount, currency, status")
    .eq("book_id", bookId);

  if (error) throw error;

  return sumByCurrencyAndStatus(
    data as { amount: number; currency: string; status: string }[]
  );
};

/**
 * The same per-currency {paid, pending} totals as {@link getPersonalBookTotals},
 * but scoped to the CURRENT calendar month. Drives the budget card on a book
 * whose `budget_period` is 'monthly' (a 'total' budget just uses the all-time
 * totals instead).
 */
export const getPersonalBookMonthTotals = async (
  bookId: string
): Promise<PersonalBookTotal[]> => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  try {
    const user = await supabase.auth.getUser();
    if (!user.data.user) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from(tables.PERSONAL_EXPENSES_TBL)
      .select("amount, currency, status")
      .eq("book_id", bookId)
      .gte("expense_date", startOfMonth.toISOString());

    if (error) throw error;

    return sumByCurrencyAndStatus(
      data as { amount: number; currency: string; status: string }[]
    );
  } catch (error) {
    // Offline — fall back to the cached book detail. That snapshot holds only
    // the first page of expenses, which is sorted newest-first and so normally
    // covers the whole current month; on a very busy book the offline figure
    // can under-report until the next sync.
    const cached = await cacheService.getBookDetail(bookId).catch(() => null);
    if (!cached) throw error;

    const inMonth = (cached.expenseList as PersonalExpense[]).filter(
      (e) => new Date(e.expense_date || e.created_at) >= startOfMonth
    );
    return sumByCurrencyAndStatus(inMonth);
  }
};

/**
 * Fold expense rows into per-currency {paid, pending} totals. Shared by the book
 * and monthly totals. Any status other than 'pending' counts as paid (so legacy
 * rows without a status still land in the paid bucket).
 */
function sumByCurrencyAndStatus(
  rows: { amount: number; currency: string; status?: string }[]
): PersonalBookTotal[] {
  const byCurrency = new Map<string, { paid: number; pending: number }>();
  for (const row of rows) {
    const currency = row.currency || "PHP";
    const entry = byCurrency.get(currency) ?? { paid: 0, pending: 0 };
    if (row.status === "pending") entry.pending += row.amount;
    else entry.paid += row.amount;
    byCurrency.set(currency, entry);
  }

  return Array.from(byCurrency.entries())
    .map(([currency, v]) => ({ currency, paid: v.paid, pending: v.pending }))
    .sort((a, b) => b.paid + b.pending - (a.paid + a.pending));
}

/**
 * This calendar month's personal spending across ALL of the user's books,
 * broken down per currency (never converted) and per status (paid vs pending).
 * Drives the Overview "Personal spending · This month" card. Summed client-side.
 */
export const getPersonalMonthlyTotals = async (
  userId: string
): Promise<PersonalBookTotal[]> => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data, error } = await supabase
      .from(tables.PERSONAL_EXPENSES_TBL)
      .select("amount, currency, status")
      .eq("user_id", userId)
      .gte("expense_date", startOfMonth.toISOString());

    if (error) throw error;

    const totals = sumByCurrencyAndStatus(
      data as { amount: number; currency: string; status: string }[]
    );

    // Snapshot so the Overview card shows the last value offline.
    cacheService.savePersonalMonthly(userId, totals).catch(() => {});

    return totals;
  } catch (error) {
    const cached = await cacheService.getPersonalMonthly(userId);
    if (cached) return cached as PersonalBookTotal[];
    throw error;
  }
};

/**
 * How many personal expenses the user has created today (server count from the
 * append-only log). Drives the free-tier 5/day gate. Deleting an expense never
 * refunds a slot (the log is never touched on delete).
 */
export const getDailyPersonalCount = async (
  userId: string
): Promise<number> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from(tables.PERSONAL_EXPENSE_CREATION_LOG_TBL)
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", today.toISOString());

  if (error) throw error;
  return count ?? 0;
};
