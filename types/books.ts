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

export type BookState = {
  list: Book[];
  /** True once the book list has been fetched at least once, so consumers can
   * tell "still loading" apart from "genuinely has no books". */
  initialized: boolean;
  details: Book | null;
  /** Expenses for the currently-open book detail. */
  expenseList: PersonalExpense[];
};
