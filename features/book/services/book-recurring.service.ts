import { savePersonalExpense } from "@/features/book/services/book-expense.service";
import { computeInitialNextRunAt } from "@/features/expense/utils/recurrence.util";
import { PersonalRecurring } from "@/types/books";
import { RecurrenceConfig } from "@/types/expenses";
import { tables } from "@/utils/constants";
import { supabase } from "@/utils/supabase";
import "react-native-get-random-values";
import { v4 as uuid } from "uuid";

// =====================================================================
// Personal recurring expenses (Pro)
//
// A personal recurring expense is a template + schedule stored in
// personal_recurring_tbl. The run-recurring Edge Function (invoked by pg_cron,
// the SAME job that materializes group recurring expenses) posts occurrences
// server-side. The client only creates/edits/pauses/deletes the template; the
// one exception is the *first* occurrence, generated inline at creation time so
// the user sees it immediately (below).
//
// This mirrors the group flow in features/expense/services/expense.service.ts
// but is much simpler — a personal expense has no payers, splits, or
// settlements, so there are no snapshots to store or reconcile.
// =====================================================================

const RECURRING_SELECT = `id, created_at, updated_at, book_id, user_id, amount, description, category, currency, frequency, repeat_interval, start_date, end_type, end_date, occurrence_limit, occurrences_count, next_run_at, last_run_at, is_active`;

/**
 * Create a personal recurring-expense template. If the series starts today or
 * earlier, the first occurrence is generated immediately (reusing
 * `savePersonalExpense`, so it posts exactly like a manual entry and shows in
 * the book right away) and the schedule is advanced one step; a future start
 * date just parks the template for the generator to pick up.
 */
export const savePersonalRecurring = async (payload: {
  book_id: string;
  amount: number;
  description: string;
  currency: string;
  /** Spending category; defaults to "general" when omitted. */
  category?: string;
  recurrence: RecurrenceConfig;
}) => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { book_id, amount, description, currency, category, recurrence } =
    payload;

  const startsToday =
    new Date(recurrence.start_date).setHours(0, 0, 0, 0) <=
    new Date().setHours(0, 0, 0, 0);
  const nextRunAt = computeInitialNextRunAt(recurrence);

  const recurringId = uuid();
  const { error } = await supabase.from(tables.PERSONAL_RECURRING_TBL).insert([
    {
      id: recurringId,
      book_id,
      user_id: user.data.user.id,
      amount,
      description,
      currency: currency || "PHP",
      category: category || "general",
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

  // Materialize the first occurrence now so it lands in the book immediately.
  // Future runs are the generator's job.
  if (startsToday) {
    await savePersonalExpense({
      book_id,
      user_id: user.data.user.id,
      amount,
      description,
      category: category || "general",
      currency,
      expense_date: new Date(recurrence.start_date),
      proof_of_payment: null,
      recurring_id: recurringId
    });
  }

  return { success: true, id: recurringId };
};

/** A single personal recurring template by id (for the details screen). */
export const getPersonalRecurringById = async (
  recurringId: string
): Promise<PersonalRecurring | null> => {
  const { data, error } = await supabase
    .from(tables.PERSONAL_RECURRING_TBL)
    .select(RECURRING_SELECT)
    .eq("id", recurringId)
    .maybeSingle();

  if (error) throw error;
  return (data as PersonalRecurring) ?? null;
};

/** All personal recurring templates for a book (active + paused), newest first. */
export const getPersonalRecurringByBookId = async (
  bookId: string
): Promise<PersonalRecurring[]> => {
  const { data, error } = await supabase
    .from(tables.PERSONAL_RECURRING_TBL)
    .select(RECURRING_SELECT)
    .eq("book_id", bookId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as PersonalRecurring[]) ?? [];
};

/**
 * Edit a personal recurring template. Only future occurrences are affected —
 * occurrences already generated are independent expenses and are left untouched.
 */
export const updatePersonalRecurring = async (
  recurringId: string,
  patch: Partial<{
    amount: number;
    description: string;
    currency: string;
    category: string;
    frequency: string;
    repeat_interval: number;
    start_date: string;
    end_type: string;
    end_date: string | null;
    occurrence_limit: number | null;
    next_run_at: string;
  }>
) => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from(tables.PERSONAL_RECURRING_TBL)
    .update(patch)
    .eq("id", recurringId)
    .eq("user_id", user.data.user.id);

  if (error) throw error;
  return { success: true };
};

/** Pause (is_active=false) or resume a personal recurring series. */
export const setPersonalRecurringActive = async (
  recurringId: string,
  isActive: boolean
) => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from(tables.PERSONAL_RECURRING_TBL)
    .update({ is_active: isActive })
    .eq("id", recurringId)
    .eq("user_id", user.data.user.id);

  if (error) throw error;
  return { success: true };
};

/**
 * Delete a personal recurring series. Future generation stops; occurrences
 * already posted survive (their `recurring_id` FK is ON DELETE SET NULL).
 */
export const deletePersonalRecurring = async (recurringId: string) => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from(tables.PERSONAL_RECURRING_TBL)
    .delete()
    .eq("id", recurringId)
    .eq("user_id", user.data.user.id);

  if (error) throw error;
  return { success: true };
};
