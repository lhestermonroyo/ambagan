import EmptyList from "@/components/EmptyList";
import { ExpenseListSkeleton } from "@/components/SkeletonLoader";
import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import RecurringItem from "@/features/expense/components/RecurringItem";
import { RecurringExpense } from "@/types/expenses";
import { EmptyType } from "@/types/general";
import { useRouter } from "expo-router";

/**
 * A group's recurring-expense series: next run + schedule at a glance. Any
 * member can view; tapping a card opens the details screen, where the series
 * creator gets pause/resume + delete (RLS enforces the same server-side).
 *
 * Presentational + controlled: the parent route owns the fetch/loading state and
 * passes `items`, so the same component renders both the main list and the
 * filtered search results (in the SearchDrawer) off one source of truth. Renders
 * inline (no scroll container of its own) so the route can wrap it. Mirrors the
 * personal BookRecurring list.
 */
export default function GroupRecurring({
  groupId,
  items,
  loading = false,
  isOnline = true,
  emptyContent,
  onItemPress
}: {
  groupId: string;
  items: RecurringExpense[];
  loading?: boolean;
  isOnline?: boolean;
  /** Overrides the default empty-state copy (e.g. for a load-failed state). */
  emptyContent?: string;
  /** Overrides the default navigate-to-detail behavior (used to close the search
   *  drawer before navigating). */
  onItemPress?: (item: RecurringExpense) => void;
}) {
  const router = useRouter();

  const handlePress = (item: RecurringExpense) => {
    if (onItemPress) return onItemPress(item);
    router.push(`/groups/${groupId}/recurring/${item.id}`);
  };

  if (loading && items.length === 0) {
    return (
      <VStack className="p-4">
        <ExpenseListSkeleton />
      </VStack>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyList
        type={EmptyType.EXPENSE}
        content={
          emptyContent ??
          (isOnline
            ? "No recurring expenses yet. Set one up from the Add Expense screen by choosing a Repeat option."
            : "You're offline. Reconnect to view recurring expenses.")
        }
      />
    );
  }

  return (
    <VStack className="gap-y-2 px-4">
      {items.map((item) => (
        <RecurringItem
          key={item.id}
          details={item}
          onPress={() => handlePress(item)}
        />
      ))}
      <Box className="h-16" />
    </VStack>
  );
}
