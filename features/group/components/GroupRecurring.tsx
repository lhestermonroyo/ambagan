import EmptyList from "@/components/EmptyList";
import { ExpenseListSkeleton } from "@/components/SkeletonLoader";
import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import RecurringItem from "@/features/expense/components/RecurringItem";
import useAppToast from "@/hooks/use-app-toast";
import { useNetwork } from "@/hooks/useNetwork";
import services from "@/services";
import { RecurringExpense } from "@/types/expenses";
import { EmptyType } from "@/types/general";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";

/**
 * A group's recurring-expense series: next run + schedule at a glance. Any
 * member can view; tapping a card opens the details screen, where the series
 * creator gets pause/resume + delete (RLS enforces the same server-side).
 *
 * Renders inline (no scroll container of its own) so it can drop into the
 * Expenses tab's shared ScrollView, alongside the one-time expense list. The
 * standalone /recurring route wraps this in its own layout.
 */
export default function GroupRecurring({
  groupId,
  refreshTrigger = 0
}: {
  groupId: string;
  refreshTrigger?: number;
}) {
  const toast = useAppToast();
  const router = useRouter();
  const { isOnline } = useNetwork();

  const [list, setList] = useState<RecurringExpense[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchList = useCallback(async () => {
    if (!groupId) return;
    try {
      const result = await services.expense.getRecurringByGroupId(groupId);
      setList(result);
    } catch {
      // Recurring reads aren't cached, so offline they simply fail — that's the
      // offline empty state below, not an error worth a toast.
      if (isOnline) {
        toast({
          title: "Couldn't load",
          description: "Failed to load recurring expenses. Please try again.",
          type: "error"
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, isOnline]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchList().finally(() => setLoading(false));
    }, [fetchList])
  );

  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  if (loading && list.length === 0) {
    return (
      <VStack className="p-4">
        <ExpenseListSkeleton />
      </VStack>
    );
  }

  if (list.length === 0) {
    return (
      <EmptyList
        type={EmptyType.EXPENSE}
        content={
          isOnline
            ? "No recurring expenses yet. Set one up from the Add Expense screen by choosing a Repeat option."
            : "You're offline. Reconnect to view recurring expenses."
        }
      />
    );
  }

  return (
    <VStack className="gap-y-2 px-4">
      {list.map((item) => (
        <RecurringItem
          key={item.id}
          details={item}
          onPress={() => router.push(`/groups/${groupId}/recurring/${item.id}`)}
        />
      ))}
      <Box className="h-16" />
    </VStack>
  );
}
