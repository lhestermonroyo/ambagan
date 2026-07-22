import ConfirmIconButton from "@/components/ConfirmIconButton";
import EmptyList from "@/components/EmptyList";
import Icon from "@/components/Icon";
import { ExpenseListSkeleton } from "@/components/SkeletonLoader";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import {
  endSummary,
  recurrenceSummary
} from "@/features/expense/utils/recurrence.util";
import useAppToast from "@/hooks/use-app-toast";
import services from "@/services";
import states from "@/states";
import {
  RecurrenceEndType,
  RecurrenceFrequency,
  RecurringExpense
} from "@/types/expenses";
import { EmptyType } from "@/types/general";
import { format } from "date-fns";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";

/**
 * A group's recurring-expense series: next run + schedule, pause/resume, and
 * delete. Any member can view; only the series creator gets the pause/delete
 * controls (RLS enforces the same server-side). Editing a series is done from
 * the Add Expense form — kept out of scope here for v1.
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

  const { details: currentUser } = states.user();
  const userId = currentUser?.id;

  const [list, setList] = useState<RecurringExpense[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  const handleToggleActive = async (item: RecurringExpense) => {
    setBusyId(item.id);
    // Optimistic flip; revert on failure.
    setList((prev) =>
      prev.map((r) =>
        r.id === item.id ? { ...r, is_active: !r.is_active } : r
      )
    );
    try {
      await services.expense.setRecurringActive(item.id, !item.is_active);
    } catch {
      setList((prev) =>
        prev.map((r) =>
          r.id === item.id ? { ...r, is_active: item.is_active } : r
        )
      );
      toast({
        title: "Couldn't update",
        description: "Failed to change this series. Please try again.",
        type: "error"
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item: RecurringExpense) => {
    try {
      await services.expense.deleteRecurringExpense(item.id);
      setList((prev) => prev.filter((r) => r.id !== item.id));
      toast({
        title: "Series deleted",
        description: "Future occurrences won't be posted. Past ones remain.",
        type: "success"
      });
    } catch {
      toast({
        title: "Couldn't delete",
        description: "Failed to delete this series. Please try again.",
        type: "error"
      });
    }
  };

  const renderItem = (item: RecurringExpense) => {
    const isOwner = item.creator?.id === userId;
    const scheduleText = `${recurrenceSummary({
      frequency: item.frequency as RecurrenceFrequency,
      repeat_interval: item.repeat_interval
    })} • ${endSummary({
      end_type: item.end_type as RecurrenceEndType,
      end_date: item.end_date,
      occurrence_limit: item.occurrence_limit
    })}`;

    return (
      <VStack key={item.id} className="bg-background-50 rounded-lg p-4 gap-y-4">
        <HStack className="items-start justify-between gap-x-2">
          <VStack className="flex-1 gap-y-0.5">
            <Text className="text-lg" numberOfLines={1}>
              {item.description}
            </Text>
            <Text className="text-primary-500 text-2xl" bold>
              {formatAmount(item.amount, item.currency)}
            </Text>
          </VStack>
          <Badge
            size="sm"
            variant="solid"
            className={`rounded-full px-3 py-1 ${
              item.is_active ? "bg-success-50" : "bg-background-100"
            }`}
          >
            <BadgeText
              className={`font-bold text-xs uppercase ${
                item.is_active ? "text-success-600" : "text-secondary-500"
              }`}
            >
              {item.is_active ? "Active" : "Paused"}
            </BadgeText>
          </Badge>
        </HStack>

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

        {isOwner && (
          <HStack className="items-center justify-between pt-1 border-t border-background-100">
            <HStack className="items-center gap-x-2 pt-2">
              <Text className="text-sm text-secondary-950">
                {item.is_active ? "Pause series" : "Resume series"}
              </Text>
              <Switch
                value={item.is_active}
                disabled={busyId === item.id}
                onValueChange={() => handleToggleActive(item)}
              />
            </HStack>
            <ConfirmIconButton
              icon="delete"
              variant="link"
              iconClassName="text-error-500"
              confirmTitle="Delete recurring series?"
              confirmDescription="Future occurrences won't be posted. Expenses already created stay in the group."
              isDelete
              onConfirm={() => handleDelete(item)}
            />
          </HStack>
        )}
      </VStack>
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
