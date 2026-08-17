import { isWithinRange } from "@/features/group/components/DateRangeSheet";
import services from "@/services";
import states from "@/states";
import { Book } from "@/types/books";
import { isConverted, useConverter } from "@/utils/fx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * The two halves of the "what did this actually cost me?" roll-up, one hook
 * each. A group and a personal book can be LINKED (personal_books_tbl.group_id):
 * on a trip the shared dinners live in the group and the solo souvenirs in the
 * book, and neither surface can answer the question alone.
 *
 * The halves stay separate all the way to the screen — the cards render them as
 * two lines that visibly sum, never as one blended figure. The reason is the
 * feature's main failure mode: a user who logs their share of a shared expense
 * in their book too would double-count it, and a breakdown makes that spottable
 * where a single number hides it. Automatic de-duplication is deliberately NOT
 * attempted; matching on amount + date would false-positive on the genuinely
 * repeated expenses (the same ¥800 lunch three days running) that trips are
 * full of.
 *
 * Both hooks convert into a caller-chosen currency and, like the rest of the
 * stats surfaces, drop anything they hold no rate for rather than counting it as
 * zero — a total that is understated is recoverable, one that is wrong is not.
 */

/** One converted side of the roll-up, with its own approximation flag. */
type Half = { amount: number; approx: boolean };

const EMPTY: Half = { amount: 0, approx: false };

/**
 * PERSONAL half — the linked book's own spending, for the group's Stats tab.
 *
 * `paid` and `pending` are reported apart: an unpaid bill isn't money out yet,
 * so it stays out of the headline total and gets its own line, matching how
 * BookStatsTab and the budget card already treat pending.
 */
export function useLinkedBookTotals(
  groupId: string | undefined,
  cutoff: Date | null,
  until: Date | null,
  targetCurrency: string
) {
  // Loaded rows are stored WITH the group they were fetched for. Keying them
  // this way (rather than clearing state when groupId changes) means a stale
  // payload is ignored by construction — there's no render in between where the
  // previous group's spending is shown against the new group's share.
  const [data, setData] = useState<{
    key: string;
    book: Book | null;
    expenses: { amount: number; currency: string; status: string; date: string }[];
  } | null>(null);
  const convert = useConverter(targetCurrency);

  // Bumped by refresh() so the group card can re-read after the user links or
  // unlinks a book.
  const [reloadToken, setReloadToken] = useState(0);
  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!groupId) return;

    const requestId = ++requestIdRef.current;

    services.book
      .getBookByGroupId(groupId)
      .then(async (found) => {
        if (requestId !== requestIdRef.current) return;
        if (!found) {
          setData({ key: groupId, book: null, expenses: [] });
          return;
        }
        const rows = await services.bookExpense.getAllPersonalExpensesByBookId(
          found.id
        );
        if (requestId !== requestIdRef.current) return;
        setData({
          key: groupId,
          book: found,
          expenses: rows.map((e) => ({
            amount: e.amount,
            currency: e.currency || "PHP",
            status: e.status,
            // Same field BookStatsTab filters on — an expense dated last week
            // but entered today belongs to last week.
            date: e.expense_date || e.created_at
          }))
        });
      })
      .catch(() => {
        // Offline or a failed read: fall back to "no personal half" rather than
        // blocking the group figures the card can still show.
        if (requestId !== requestIdRef.current) return;
        setData({ key: groupId, book: null, expenses: [] });
      });
  }, [groupId, reloadToken]);

  const current = groupId && data?.key === groupId ? data : null;

  const { paid, pending } = useMemo(() => {
    const acc = { paid: { ...EMPTY }, pending: { ...EMPTY } };
    for (const e of current?.expenses ?? []) {
      if (!isWithinRange(e.date, cutoff, until)) continue;
      const value = convert(e.amount, e.currency);
      if (value === null) continue;
      const side = e.status === "pending" ? acc.pending : acc.paid;
      side.amount += value;
      side.approx ||= isConverted(e.amount, e.currency, targetCurrency);
    }
    return acc;
  }, [current, cutoff, until, convert, targetCurrency]);

  return {
    book: current?.book ?? null,
    paid,
    pending,
    // Loading until THIS group's rows have landed, so the card holds an em dash
    // instead of briefly rendering a confident ₱0.00. A refresh() re-fetch keeps
    // showing the previous figures rather than flashing a dash.
    loading: !!groupId && !current,
    refresh
  };
}

/**
 * GROUP half — the current user's SHARE of the linked group's split expenses,
 * for the book's Stats tab.
 *
 * Share, not what they paid: fronting the cash for a group dinner nets out at
 * settlement, so it was never really this person's cost. The group's own Stats
 * tab computes the same figure from splits it already holds in state
 * (GroupPersonalStats); the book side has none of that loaded, so this fetches
 * the group's expenses and their splits itself.
 */
export function useLinkedGroupShare(
  groupId: string | null | undefined,
  cutoff: Date | null,
  until: Date | null,
  targetCurrency: string
) {
  const { details: userDetails } = states.user();
  const userId = userDetails?.id;

  // Keyed by group for the same reason as useLinkedBookTotals above.
  const [data, setData] = useState<{
    key: string;
    splits: { amount: number; currency: string; date: string }[];
  } | null>(null);
  const convert = useConverter(targetCurrency);

  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!groupId || !userId) return;

    const requestId = ++requestIdRef.current;

    services.expense
      .getExpensesByGroupId(groupId)
      .then(async (expenses: any[]) => {
        if (requestId !== requestIdRef.current) return;
        // Drafts carry an amount but no splits yet — they aren't spending.
        const finalized = expenses.filter((e) => !e.is_draft);
        if (finalized.length === 0) {
          setData({ key: groupId, splits: [] });
          return;
        }
        const rows = await services.expense.getMemberSplitsByExpenseIds(
          finalized.map((e) => e.id)
        );
        if (requestId !== requestIdRef.current) return;

        // Splits don't carry a date, so date each one by its parent expense —
        // the same field the group Stats tab ranges on.
        const dateByExpenseId = new Map<string, string>(
          finalized.map((e) => [e.id, e.created_at])
        );
        setData({
          key: groupId,
          splits: rows
            .filter((s) => s.member.id === userId)
            .map((s) => ({
              amount: s.amount,
              currency: s.currency,
              date: dateByExpenseId.get(s.expense_id) ?? ""
            }))
        });
      })
      .catch(() => {
        if (requestId !== requestIdRef.current) return;
        setData({ key: groupId, splits: [] });
      });
  }, [groupId, userId]);

  const current = groupId && data?.key === groupId ? data : null;

  const share = useMemo(() => {
    const acc = { ...EMPTY };
    for (const s of current?.splits ?? []) {
      if (s.date && !isWithinRange(s.date, cutoff, until)) continue;
      const value = convert(s.amount, s.currency);
      if (value === null) continue;
      acc.amount += value;
      acc.approx ||= isConverted(s.amount, s.currency, targetCurrency);
    }
    return acc;
  }, [current, cutoff, until, convert, targetCurrency]);

  return {
    share,
    loading: !!groupId && !current
  };
}

/**
 * Headline for the combined figure, taken from the group's category so a trip
 * reads as a trip and an apartment as a household. Everything else — work
 * lunches, a couple's shared account — gets the neutral wording.
 */
export function combinedTotalLabel(groupCategory?: string): string {
  switch (groupCategory) {
    case "trip":
      return "Trip total";
    case "household":
      return "Household total";
    case "event":
      return "Event total";
    default:
      return "Combined total";
  }
}
