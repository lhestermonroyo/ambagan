import EmptyList from "@/components/EmptyList";
import { ExpenseListSkeleton } from "@/components/SkeletonLoader";
import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import RecurringItem from "@/features/expense/components/RecurringItem";
import { PersonalRecurring } from "@/types/books";
import { EmptyType } from "@/types/general";
import { useRouter } from "expo-router";

/**
 * A book's personal recurring-expense series: next run + schedule at a glance.
 * Tapping a card opens the details screen. Mirrors the group GroupRecurring list,
 * minus the member/split parts a personal book doesn't have.
 *
 * Presentational + controlled: the parent route owns the fetch/loading state and
 * passes `items`, so the same component renders both the main list and the
 * filtered search results (in the SearchDrawer) off one source of truth. Renders
 * inline (no scroll container of its own) so the route can wrap it.
 */
export default function BookRecurring({
  bookId,
  items,
  loading = false,
  isOnline = true,
  emptyContent,
  onItemPress
}: {
  bookId: string;
  items: PersonalRecurring[];
  loading?: boolean;
  isOnline?: boolean;
  /** Overrides the default empty-state copy (e.g. for a no-search-matches state). */
  emptyContent?: string;
  /** Overrides the default navigate-to-detail behavior (used to close the search
   *  drawer before navigating). */
  onItemPress?: (item: PersonalRecurring) => void;
}) {
  const router = useRouter();

  const handlePress = (item: PersonalRecurring) => {
    if (onItemPress) return onItemPress(item);
    router.push(`/books/${bookId}/recurring/${item.id}`);
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
          showChevron={false}
        />
      ))}
      <Box className="h-16" />
    </VStack>
  );
}
