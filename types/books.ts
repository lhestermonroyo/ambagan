/**
 * How a book's budget is measured:
 *   * `monthly` — a recurring cap that resets each calendar month, for books
 *     that run indefinitely ("Daily", "Groceries").
 *   * `total` — one lifetime cap for the whole book, for finite ones
 *     ("Japan Trip"), where a mid-trip monthly reset would make no sense.
 */
export type BookBudgetPeriod = "monthly" | "total";

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
  /** Optional spending cap, in the book's own {@link Book.currency}. Null = no
   *  budget set. Expenses in another currency count against it too, converted at
   *  an approximate rate (utils/fx) purely for this display — the expense itself
   *  always keeps the currency it was entered in. */
  budget: number | null;
  /** How {@link Book.budget} is measured. Meaningless when `budget` is null. */
  budget_period: BookBudgetPeriod;
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
  /** Whether the expense is actually settled ('paid', the default) or still an
   *  upcoming/unpaid bill ('pending'). Purely a personal tracking flag — books
   *  have no settlements. Paid vs pending totals are reported split out. */
  status: "paid" | "pending";
  /** True for an expense created offline and not yet synced to the server. */
  pending?: boolean;
};

/** The two states a personal expense's {@link PersonalExpense.status} can hold. */
export type PersonalExpenseStatus = "paid" | "pending";

/**
 * Per-currency spend for a book (or a month), split by status — `paid` is money
 * actually settled, `pending` is upcoming/unpaid bills. Currencies are never
 * converted against each other; each is reported on its own entry. Total for an
 * entry is `paid + pending`.
 */
export type PersonalBookTotal = {
  currency: string;
  paid: number;
  pending: number;
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

/**
 * One budgeted book's spend against its cap, as the Overview's budget rollup
 * needs it. Spend is the budget's OWN window — this month for a `monthly` book,
 * all-time for a `total` one — and stays per-currency here: converting it is a
 * display decision (see BookBudgetCard), and the rollup makes the same one with
 * the same rates rather than being handed a pre-folded number.
 */
export type PersonalBudgetUsage = {
  bookId: string;
  name: string;
  /** The currency the budget is set in. */
  currency: string;
  budget: number;
  period: BookBudgetPeriod;
  /** PAID spend in the budget's window, per currency. Pending is excluded, so
   *  this matches what fills the bar on the book's own budget card. */
  spent: { currency: string; amount: number }[];
};

/**
 * Everything the Overview's personal-spending card shows, in one payload:
 * this month's spend, the same stretch of last month to compare it against, and
 * every budgeted book's usage.
 */
export type PersonalOverview = {
  /** This calendar month to date, per currency, paid vs pending. Named for the
   *  window rather than `current`, which the React Compiler's lint reads as a
   *  ref access and bails on. */
  thisMonth: PersonalBookTotal[];
  /**
   * LAST month truncated to the same day — month-to-date against month-to-date,
   * so a comparison made on the 2nd isn't measured against a full month and
   * doesn't report a 90% drop. Clamped when last month is shorter (Mar 31 has
   * no counterpart in February).
   */
  lastMonth: PersonalBookTotal[];
  /** Non-archived books with a cap set. Empty when the user budgets nothing. */
  budgets: PersonalBudgetUsage[];
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
