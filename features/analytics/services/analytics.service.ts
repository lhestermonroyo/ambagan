import { tables } from "@/utils/constants";
import { supabase } from "@/utils/supabase";

/**
 * The data layer behind Spending Analytics — the one screen that spans BOTH
 * halves of the app, group splits and personal books, and so is the only place
 * that can answer "what did I actually spend".
 *
 * Everything is normalized into a flat {@link AnalyticsEntry} list rather than
 * pre-aggregated per stat. The screen derives a dozen figures from the same
 * rows (category split, trend, top expenses, fronting, recurring share); giving
 * each its own query would mean a dozen round trips over the same data, and
 * aggregates that can silently disagree with each other. Folding happens in
 * useAnalytics, which also owns the currency conversion — rates live in a
 * client-side store, so a converted figure can't be computed here anyway.
 *
 * Date filtering is done SERVER-side, on the embedded expense. The previous
 * version fetched every split the user had ever been part of and filtered in
 * JS, which is fine at a few hundred expenses and not at a few thousand.
 */

export type AnalyticsSource = "group" | "personal";

/**
 * One expense, from the current user's point of view. The same shape whether it
 * came from a group split or a personal book, which is what lets every stat on
 * the screen be a fold over one list.
 */
export type AnalyticsEntry = {
  /** Expense id — unique within a source, so pair with `source` when keying. */
  id: string;
  source: AnalyticsSource;
  /** group_id, or book_id for a personal expense. */
  containerId: string;
  containerName: string;
  /** `expense_date` — when the money was spent, not when it was typed in. */
  date: string;
  category: string;
  currency: string;
  description: string;
  /**
   * What this expense COST the user: their split of a group expense, or the
   * whole amount of a personal one. This is the figure every spending total is
   * built from — see `paid` for why.
   */
  share: number;
  /**
   * What the user FRONTED. Differs from `share` only on group expenses, where
   * paying for the table doesn't mean consuming it — the difference nets out at
   * settlement. Equal to `share` for personal expenses, which have no such
   * distinction.
   */
  paid: number;
  /** Posted by a recurring rule rather than entered by hand. */
  recurring: boolean;
  /** Personal only — a logged bill that hasn't been paid yet, so not money out. */
  pending: boolean;
};

export type TopPartner = {
  id: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  count: number;
};

export type AnalyticsFetch = {
  /** Entries inside the selected range. */
  current: AnalyticsEntry[];
  /**
   * The equal-length window immediately before the selected one, for the
   * period-over-period delta. Empty when there's nothing to compare against
   * (an "All Time" range has no "before").
   */
  previous: AnalyticsEntry[];
  /** Computed over `current` only. Group expenses have partners; books don't. */
  partners: TopPartner[];
};

/** Embedded expense fields every group entry is built from. */
const SPLIT_SELECT = `amount, expense_id, expense:expense_id!inner(id, expense_date, created_at, group_id, currency, category, description, recurring_id, is_draft, group:group_id(name))`;

const PERSONAL_SELECT = `id, expense_date, created_at, book_id, amount, currency, category, description, recurring_id, status, book:book_id(name)`;

/**
 * PostgREST returns an embedded one-to-one as either an object or a
 * single-element array depending on how it inferred the relationship. Same
 * defensive unwrap the expense service uses.
 */
const unwrap = <T>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

/**
 * The window to compare the selection against: the same span, immediately
 * before it. Null when no honest comparison exists — an open-ended "All Time"
 * range has no preceding period, and a zero-length range has nothing to scale.
 */
export const getComparisonWindow = (
  start: Date | null,
  end: Date | null
): { start: Date; end: Date } | null => {
  if (!start) return null;
  const finish = end ?? new Date();
  const span = finish.getTime() - start.getTime();
  if (span <= 0) return null;
  return {
    // Ends a millisecond before the selection starts, so the two windows are
    // adjacent and an expense can never land in both.
    start: new Date(start.getTime() - span),
    end: new Date(start.getTime() - 1)
  };
};

/**
 * Every expense touching the user in `[start, end]`, plus the preceding window
 * of equal length. Both are fetched in ONE pass over the union of the two
 * windows and partitioned here — the comparison doubles the rows, not the round
 * trips.
 *
 * A null `start` means all time; a null `end` means up to now.
 */
export const getAnalyticsData = async (
  userId: string,
  start: Date | null,
  end: Date | null = null
): Promise<AnalyticsFetch> => {
  const comparison = getComparisonWindow(start, end);
  // Widen the fetch to cover the comparison window too, then split below.
  const fetchStart = comparison ? comparison.start : start;

  const [memberRows, payerRows, personalRows] = await Promise.all([
    fetchGroupSplits(tables.MEMBER_SPLITS_TBL, "member_id", userId, fetchStart, end),
    fetchGroupSplits(tables.EXPENSE_PAYERS_TBL, "payer_id", userId, fetchStart, end),
    fetchPersonalExpenses(userId, fetchStart, end)
  ]);

  // A user can be both a payer and a member on the same expense, so the two
  // split queries fold into one entry each rather than producing duplicates.
  const byExpense = new Map<string, AnalyticsEntry>();

  const upsert = (row: any): AnalyticsEntry | null => {
    const expense = unwrap<any>(row.expense);
    if (!expense) return null;
    const existing = byExpense.get(expense.id);
    if (existing) return existing;
    const entry: AnalyticsEntry = {
      id: expense.id,
      source: "group",
      containerId: expense.group_id,
      containerName: unwrap<any>(expense.group)?.name ?? "Unknown Group",
      date: expense.expense_date || expense.created_at,
      category: expense.category || "general",
      currency: expense.currency || "PHP",
      description: expense.description ?? "",
      share: 0,
      paid: 0,
      recurring: !!expense.recurring_id,
      pending: false
    };
    byExpense.set(expense.id, entry);
    return entry;
  };

  for (const row of memberRows) {
    const entry = upsert(row);
    if (entry) entry.share += Number(row.amount) || 0;
  }
  for (const row of payerRows) {
    const entry = upsert(row);
    if (entry) entry.paid += Number(row.amount) || 0;
  }

  for (const row of personalRows as any[]) {
    const amount = Number(row.amount) || 0;
    byExpense.set(`personal:${row.id}`, {
      id: row.id,
      source: "personal",
      containerId: row.book_id,
      containerName: unwrap<any>(row.book)?.name ?? "Unknown Book",
      date: row.expense_date || row.created_at,
      category: row.category || "general",
      currency: row.currency || "PHP",
      description: row.description ?? "",
      share: amount,
      paid: amount,
      recurring: !!row.recurring_id,
      pending: row.status === "pending"
    });
  }

  const all = Array.from(byExpense.values());

  // Partition against the selection. Anything before it belongs to the
  // comparison window — it can only have been fetched because one exists.
  const current: AnalyticsEntry[] = [];
  const previous: AnalyticsEntry[] = [];
  for (const entry of all) {
    const time = new Date(entry.date).getTime();
    if (start && time < start.getTime()) previous.push(entry);
    else current.push(entry);
  }

  const partners = await fetchTopPartners(
    userId,
    current.filter((e) => e.source === "group").map((e) => e.id)
  );

  return { current, previous, partners };
};

/**
 * The user's splits from one of the two split tables, with their parent expense
 * embedded. `!inner` on the embed is what makes the date and draft filters below
 * apply to the expense rather than being ignored.
 *
 * Drafts are excluded: they carry an amount but no finalized splits, so counting
 * them would report money that hasn't been committed to.
 */
const fetchGroupSplits = async (
  table: string,
  userColumn: string,
  userId: string,
  start: Date | null,
  end: Date | null
) => {
  let query = supabase
    .from(table)
    .select(SPLIT_SELECT)
    .eq(userColumn, userId)
    .eq("expense.is_draft", false);

  if (start) query = query.gte("expense.expense_date", start.toISOString());
  if (end) query = query.lte("expense.expense_date", end.toISOString());

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as any[];
};

/** Personal expenses across every one of the user's books, already user-scoped. */
const fetchPersonalExpenses = async (
  userId: string,
  start: Date | null,
  end: Date | null
) => {
  let query = supabase
    .from(tables.PERSONAL_EXPENSES_TBL)
    .select(PERSONAL_SELECT)
    .eq("user_id", userId);

  if (start) query = query.gte("expense_date", start.toISOString());
  if (end) query = query.lte("expense_date", end.toISOString());

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as any[];
};

/**
 * Who the user splits with most, by number of shared expenses. Ranked by count
 * rather than amount on purpose — this answers "who do I go out with", and a
 * single expensive trip shouldn't outrank a year of weekly lunches.
 */
const fetchTopPartners = async (
  userId: string,
  expenseIds: string[]
): Promise<TopPartner[]> => {
  if (expenseIds.length === 0) return [];

  const { data, error } = await supabase
    .from(tables.MEMBER_SPLITS_TBL)
    .select(
      "expense_id, member_id, member:member_id (id, first_name, last_name, avatar)"
    )
    .in("expense_id", expenseIds)
    .neq("member_id", userId);

  if (error) throw error;

  const partnerMap = new Map<string, { user: any; count: number }>();
  for (const split of (data ?? []) as any[]) {
    const member = unwrap<any>(split.member);
    if (!member) continue;
    const entry = partnerMap.get(split.member_id);
    if (entry) entry.count += 1;
    else partnerMap.set(split.member_id, { user: member, count: 1 });
  }

  return Array.from(partnerMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(({ user, count }) => ({
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      avatar: user.avatar ?? null,
      count
    }));
};
