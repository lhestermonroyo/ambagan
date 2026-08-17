import services from "@/services";
import { ExpensePreview, MemberSplit } from "@/types/expenses";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Fetches the member splits for a set of (already date-range-filtered) expenses.
 * Lifted out of GroupMemberBreakdown so the Stats tab can fetch once and share
 * the result across the personal "Your Activity" card and the group breakdown,
 * rather than each hitting the network for the same rows.
 *
 * Drafts are ignored — they carry an amount but no splits yet.
 */
export function useMemberSplits(expenses: ExpensePreview[]) {
  const [splits, setSplits] = useState<MemberSplit[]>([]);
  const [loading, setLoading] = useState(false);

  const finalized = useMemo(
    () => expenses.filter((e) => !e.is_draft),
    [expenses],
  );

  // Stable key so the fetch only re-runs when the actual set of expenses (i.e.
  // the selected date range) changes, not on every render.
  const expenseIdsKey = useMemo(
    () =>
      finalized
        .map((e) => e.id)
        .sort()
        .join(","),
    [finalized],
  );

  const requestIdRef = useRef(0);

  useEffect(() => {
    const ids = expenseIdsKey ? expenseIdsKey.split(",") : [];
    if (ids.length === 0) {
      setSplits([]);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    services.expense
      .getMemberSplitsByExpenseIds(ids)
      .then((data) => {
        // Ignore a stale response that resolves after a newer range change.
        if (requestId === requestIdRef.current) setSplits(data);
      })
      .catch(() => {
        if (requestId === requestIdRef.current) setSplits([]);
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });
  }, [expenseIdsKey]);

  return { splits, loading };
}
