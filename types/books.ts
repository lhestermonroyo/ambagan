/**
 * A "book" is a standalone personal-expense ledger owned by a single user
 * (e.g. "Daily", "Japan Trip", "Groceries"). Unlike a group it has no members,
 * splits, or settlements — it just holds the owner's personal expenses.
 */
export type Book = {
  id: string;
  created_at: string;
  user_id: string;
  name: string;
  category: string;
  avatar: string | null;
  currency: string;
  /** Forward-compat (v1: design-for, not built) — per-book monthly cap. */
  budget: number | null;
  archived: boolean;
  /** Forward-compat (v1: unused) — future group→book roll-up link. */
  group_id: string | null;
  /** Count of personal expenses in this book (computed on list queries). */
  expense_count: number;
  /** True for a book created offline and not yet synced to the server. */
  pending?: boolean;
};

/**
 * One personal-expense entry inside a book. No payers, splits, or settlements —
 * it's just the owner's own spending. Currency is inherited from the parent book.
 */
export type PersonalExpense = {
  id: string;
  created_at: string;
  book_id: string;
  user_id: string;
  amount: number;
  description: string;
  category: string;
  currency: string;
  expense_date: string;
  proof_of_payment: string | null;
  recurring_id: string | null;
  /** True for an expense created offline and not yet synced to the server. */
  pending?: boolean;
};

/**
 * A personal recurring-expense *template* + schedule (Pro). The generator
 * (run-recurring Edge Function, invoked by pg_cron) materializes a real
 * {@link PersonalExpense} from this every time `next_run_at` passes. It mirrors
 * the group {@link import("./expenses").RecurringExpense} but is deliberately
 * simpler — a personal expense has no payers, splits, or settlements, so there
 * are no `split_type`/`payers_snapshot`/`splits_snapshot` fields.
 */
export type PersonalRecurring = {
  id: string;
  created_at: string;
  updated_at: string;
  book_id: string;
  user_id: string;
  amount: number;
  description: string;
  /** Spending category (see ExpenseCategory). Copied onto every materialized
   *  occurrence by the run-recurring generator. */
  category: string;
  currency: string;
  frequency: string;
  /** Repeat every N frequency units (e.g. every 2 weeks). */
  repeat_interval: number;
  start_date: string;
  end_type: string;
  end_date: string | null;
  occurrence_limit: number | null;
  occurrences_count: number;
  next_run_at: string;
  last_run_at: string | null;
  /** False while paused — the generator skips it until resumed. */
  is_active: boolean;
};

export type BookState = {
  list: Book[];
  /** True once the book list has been fetched at least once, so consumers can
   * tell "still loading" apart from "genuinely has no books". */
  initialized: boolean;
  details: Book | null;
  /** Expenses for the currently-open book detail. */
  expenseList: PersonalExpense[];
};
