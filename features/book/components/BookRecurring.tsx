import CategoryIcon from "@/components/CategoryIcon";
import EmptyList from "@/components/EmptyList";
import Icon from "@/components/Icon";
import { ExpenseListSkeleton } from "@/components/SkeletonLoader";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { expenseCategoryMeta } from "@/features/expense/components/CategorySheet";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import {
  endSummary,
  recurrenceSummary
} from "@/features/expense/utils/recurrence.util";
import { PersonalRecurring } from "@/types/books";
import { RecurrenceEndType, RecurrenceFrequency } from "@/types/expenses";
import { EmptyType } from "@/types/general";
import { format } from "date-fns";
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

  const renderItem = (item: PersonalRecurring) => {
    const scheduleText = `${recurrenceSummary({
      frequency: item.frequency as RecurrenceFrequency,
      repeat_interval: item.repeat_interval
    })} • ${endSummary({
      end_type: item.end_type as RecurrenceEndType,
      end_date: item.end_date,
      occurrence_limit: item.occurrence_limit
    })}`;

    return (
      <Pressable
        key={item.id}
        className="bg-background-50 rounded-lg p-4 gap-y-4 data-[hover=true]:bg-background-100 data-[active=true]:bg-background-100"
        onPress={() => handlePress(item)}
      >
        <VStack className="gap-y-2">
          <HStack className="items-start justify-between gap-x-2">
            <HStack className="flex-1 items-center gap-x-3">
              <CategoryIcon icon={expenseCategoryMeta(item.category).icon} />
              <VStack className="flex-1 gap-y-0.5">
                <Text className="text-lg" numberOfLines={1}>
                  {item.description}
                </Text>
              </VStack>
              <HStack className="items-center">
                <Badge
                  size="sm"
                  variant="solid"
                  className={`rounded-full px-3 py-1 ${
                    item.is_active ? "bg-success-50" : "bg-background-200"
                  }`}
                >
                  <BadgeText
                    className={`font-bold text-xs uppercase ${
                      item.is_active
                        ? "text-success-600"
                        : "text-typography-700"
                    }`}
                  >
                    {item.is_active ? "Active" : "Paused"}
                  </BadgeText>
                </Badge>
                <Icon as="chevron-right" className="text-secondary-950" />
              </HStack>
            </HStack>
          </HStack>

          <Text className="text-primary-500 text-2xl" bold>
            {formatAmount(item.amount, item.currency)}
          </Text>
        </VStack>
        <VStack className="gap-y-1">
          <HStack className="items-center gap-x-2">
            <Icon as="repeat" size={16} className="text-secondary-950" />
            <Text className="text-sm text-secondary-950 flex-1">
              {scheduleText}
            </Text>
          </HStack>

          {item.is_active && (
            <HStack className="items-center gap-x-2">
              <Icon as="schedule" size={16} className="text-secondary-950" />
              <Text className="text-sm text-secondary-950 flex-1">
                Next: {format(new Date(item.next_run_at), "MMM d, yyyy")}
              </Text>
            </HStack>
          )}
        </VStack>
      </Pressable>
    );
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
      {items.map(renderItem)}
      <Box className="h-16" />
    </VStack>
  );
}
