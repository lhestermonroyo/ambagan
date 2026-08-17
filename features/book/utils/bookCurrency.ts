import { Book } from "@/types/books";

/**
 * The currency a NEW expense on this book starts in.
 *
 * `default_expense_currency` is null on almost every book, meaning "follow the
 * book's currency" — resolving it here rather than defaulting the column keeps
 * the two in step when the book's currency is later edited. Every entry surface
 * (Add Expense, Scan Receipt, the recurring template) goes through this so they
 * can't drift apart on which fallback they use.
 *
 * NOT the currency to report or budget in — that's always `book.currency`.
 */
export function bookEntryCurrency(
  book: Pick<Book, "currency" | "default_expense_currency"> | null | undefined
): string | undefined {
  if (!book) return undefined;
  return book.default_expense_currency ?? book.currency;
}
