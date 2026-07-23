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
import useAppToast from "@/hooks/use-app-toast";
import services from "@/services";
import {
  RecurrenceEndType,
  RecurrenceFrequency,
  RecurringExpense
} from "@/types/expenses";
import { EmptyType } from "@/types/general";
import { format } from "date-fns";
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

  const [list, setList] = useState<RecurringExpense[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchList = useCallback(async () => {
    if (!groupId) return;
    try {
      const result = await services.expense.getRecurringByGroupId(groupId);
      setList(result);
    } catch {
      toast({
        title: "Couldn't load",
        description: "Failed to load recurring expenses. Please try again.",
        type: "error"
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

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

  const renderItem = (item: RecurringExpense) => {
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
        onPress={() => router.push(`/groups/${groupId}/recurring/${item.id}`)}
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
        content="No recurring expenses yet. Set one up from the Add Expense screen by choosing a Repeat option."
      />
    );
  }

  return (
    <VStack className="gap-y-2 px-4">
      {list.map(renderItem)}
      <Box className="h-16" />
    </VStack>
  );
}
