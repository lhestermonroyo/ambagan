import AppAvatar from "@/components/AppAvatar";
import ConfirmIconButton from "@/components/ConfirmIconButton";
import Icon from "@/components/Icon";
import LoadingWrapper from "@/components/LoadingWrapper";
import PressableListItem from "@/components/PressableListItem";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import MarkAsPaidSheet from "@/features/expense/components/MarkAsPaidSheet";
import OwerTransactionHeader from "@/features/expense/components/OwerTransactionHeader";
import PayerTransactionHeader from "@/features/expense/components/PayerTransactionHeader";
import ReviewRequestPaidSheet from "@/features/expense/components/ReviewRequestPaidSheet";
import StatusBadge from "@/features/expense/components/StatusBadge";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import useAppToast from "@/hooks/use-app-toast";
import InnerLayout from "@/layouts/InnerLayout";
import services from "@/services";
import states from "@/states";
import { Expense, ExpenseSplit } from "@/types/expenses";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Fragment, useEffect, useMemo, useState } from "react";

export default function ExpenseDetailsScreen() {
  const [loading, setLoading] = useState({
    expense: false,
    splits: false
  });
  const [splits, setSplits] = useState<ExpenseSplit[]>([]);
  const [expense, setExpense] = useState<Expense | null>(null);
  const [currentUserSplit, setCurrentUserSplit] = useState<ExpenseSplit | null>(
    null
  );
  const [markAsPaidSheet, setMarkAsPaidSheet] = useState({
    open: false,
    split: null as ExpenseSplit | null
  });
  const [reviewRequestPaidSheet, setReviewRequestPaidSheet] = useState({
    open: false,
    split: null as ExpenseSplit | null
  });

  const user = states.user();
  const group = states.group();
  const { details: groupDetails } = group;
  const { details: userDetails } = user;

  const router = useRouter();
  const params = useLocalSearchParams();
  const expenseId = params.expenseId as string;
  const groupId = params.groupId as string;

  const isCurrentUserPayer = expense?.paid_by.id === userDetails?.id;

  const showToast = useAppToast();

  useFocusEffect(
    useMemo(
      () => () => {
        if (!expenseId || !groupId) {
          return router.push(`/groups/${groupId}`);
        }

        if (!groupDetails?.expenses) {
          init(groupId, expenseId);
          return;
        }

        let currentExpense = groupDetails?.expenses.find(
          (t) => t.id === expenseId
        );

        setExpense(currentExpense || null);
        fetchSplits(expenseId);
      },
      [expenseId, groupId, groupDetails?.expenses, router]
    )
  );

  useEffect(() => {
    if (expenseId && splits) {
      if (isCurrentUserPayer) {
        const unreadSplitIds = splits
          .filter(
            (split) =>
              split.paid_by === userDetails?.id &&
              (split.status === "pending" || split.status === "requested") &&
              !split.user_read
          )
          .map((split) => split.id);

        if (unreadSplitIds.length) {
          handleMarkAsRead(unreadSplitIds);
        }
      }
    }
  }, [expenseId, splits]);

  useEffect(() => {
    if (splits.length) {
      const currentUserSplit = splits.find(
        (split) => split.member.id === userDetails?.id
      );
      setCurrentUserSplit(currentUserSplit || null);
    }
  }, [splits, userDetails]);

  const init = async (groupId: string, expenseId: string) => {
    console.log("init");
    await Promise.all([
      fetchGroupDetails(groupId),
      fetchExpenseDetails(expenseId),
      fetchSplits(expenseId)
    ]);
  };

  const fetchGroupDetails = async (groupId: string) => {
    try {
      const response = await services.group.getGroupById(groupId);

      if (!response) {
        router.push("/groups");
        return;
      }

      states.group.setState((prev) => ({
        ...prev,
        details: {
          ...prev,
          ...response
        }
      }));
    } catch (error) {
      console.log("Error fetching group details:", error);
      router.push("/groups");
    }
  };

  const fetchExpenseDetails = async (expenseId: string) => {
    setLoading((prev) => ({ ...prev, expense: true }));

    try {
      const response = await services.expense.getExpenseById(expenseId);

      if (!response) return;

      setExpense(response);
    } catch (error) {
      console.log("Error fetching expense details:", error);
    } finally {
      setLoading((prev) => ({ ...prev, expense: false }));
    }
  };

  const fetchSplits = async (expenseId: string) => {
    setLoading((prev) => ({ ...prev, splits: true }));

    try {
      const response = await services.expense.getSplitsByExpense(expenseId);

      if (!response) return;

      setSplits(response);
    } catch (error) {
      console.log("Error fetching expense details:", error);
    } finally {
      setLoading((prev) => ({ ...prev, splits: false }));
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      const deleteResponse = await services.expense.deleteExpense(expenseId);

      if (deleteResponse.success) {
        showToast("Success", "Expense deleted successfully", "success");
        router.push(`/groups/${groupId}`);
      }
    } catch (error) {
      console.log("Error deleting expense:", error);
      showToast(
        "Error",
        "Failed to delete expense. Please try again.",
        "error"
      );
    }
  };

  const handleMarkAsRead = (unreadSplits: string[]) => {
    try {
      Promise.all(
        unreadSplits.map((splitId) => services.expense.markAsRead(splitId))
      );
    } catch (error) {
      console.log("Error marking split as read:", error);
    }
  };

  const handleOpenReviewRequestPaidSheet = (split: ExpenseSplit) => {
    setReviewRequestPaidSheet({ open: true, split });
  };

  const handleOpenMarkAsPaidSheet = (split: ExpenseSplit) => {
    setMarkAsPaidSheet({ open: true, split });
  };

  const formattedSplits = useMemo(() => {
    const payerIndex = splits.findIndex(
      (split) => split.member.id === expense?.paid_by.id
    );
    const currentUserIndex = splits.findIndex(
      (split) => split.member.id === userDetails?.id
    );

    if (payerIndex === -1 && currentUserIndex === -1) return splits;

    const payerSplit = payerIndex !== -1 ? splits[payerIndex] : null;
    const currentUserSplit =
      currentUserIndex !== -1 ? splits[currentUserIndex] : null;
    const otherSplits = splits.filter(
      (_, index) => index !== payerIndex && index !== currentUserIndex
    );

    const result: ExpenseSplit[] = [];
    if (payerSplit) result.push(payerSplit);
    if (currentUserSplit && currentUserIndex !== payerIndex)
      result.push(currentUserSplit);
    return [...result, ...otherSplits];
  }, [expenseId, splits, userDetails, expense, isCurrentUserPayer]);

  const payerStats =
    useMemo(() => {
      if (!isCurrentUserPayer || !expense) return null;

      const totalPaid = splits.reduce((total, split) => {
        if (split.member.id !== expense.paid_by.id && split.status === "paid") {
          return total + split.amount;
        }
        return total;
      }, 0);
      const theyOweYouAmount = splits.reduce((total, split) => {
        if (split.member.id !== expense.paid_by.id && split.status !== "paid") {
          return total + split.amount;
        }
        return total;
      }, 0);

      return {
        totalPaid,
        theyOweYouAmount
      };
    }, [splits, expense, isCurrentUserPayer]) || null;

  return (
    <Fragment>
      <InnerLayout
        title="Expense Details"
        onBack={() => router.push(`/groups/${groupId}`)}
        actions={[
          isCurrentUserPayer && (
            <ConfirmIconButton
              variant="link"
              className="rounded-full"
              icon="delete"
              isDelete
              iconClassName="text-secondary-950"
              confirmTitle="Delete Expense"
              confirmDescription="Deleting this expense will remove splits and payments associated with it. Are you sure you want to proceed?"
              onConfirm={() => handleDeleteExpense(expenseId)}
            />
          )
        ]}
      >
        <LoadingWrapper
          isLoading={
            loading.expense || loading.splits || !expense || !currentUserSplit
          }
          text="Loading expense details, please wait..."
        >
          <ScrollView className="flex-1" bounces={false}>
            {isCurrentUserPayer ? (
              <PayerTransactionHeader
                currentUserSplit={currentUserSplit as ExpenseSplit}
                expense={expense as Expense}
                totalPaid={payerStats?.totalPaid || 0}
                theyOweYouAmount={payerStats?.theyOweYouAmount || 0}
                onRefetch={() => fetchSplits(expenseId)}
              />
            ) : (
              <OwerTransactionHeader
                currentUserSplit={currentUserSplit as ExpenseSplit}
                expense={expense as Expense}
                onRefetch={() => fetchSplits(expenseId)}
              />
            )}
            <FlatList
              className="flex-1"
              scrollEnabled={false}
              data={formattedSplits}
              keyExtractor={(item) => item.member.id}
              renderItem={({ item }) => (
                <ExpenseSplitItem
                  key={item.member.id}
                  expense={expense}
                  split={item}
                  onReviewRequestPaid={handleOpenReviewRequestPaidSheet}
                  onMarkAsPaid={handleOpenMarkAsPaidSheet}
                />
              )}
              ItemSeparatorComponent={() => (
                <Box className="mx-4">
                  <Divider className="border-secondary-100" />
                </Box>
              )}
              ListFooterComponent={() => <Box className="h-12" />}
            />
          </ScrollView>
        </LoadingWrapper>
      </InnerLayout>
      <ReviewRequestPaidSheet
        isOpen={reviewRequestPaidSheet.open}
        onClose={() => setReviewRequestPaidSheet({ open: false, split: null })}
        expenseSplit={reviewRequestPaidSheet.split as ExpenseSplit}
        onRefetch={() => fetchSplits(expenseId)}
        isPayer={isCurrentUserPayer}
      />
      <MarkAsPaidSheet
        isOpen={markAsPaidSheet.open}
        onClose={() => setMarkAsPaidSheet({ open: false, split: null })}
        expenseSplit={markAsPaidSheet.split as ExpenseSplit}
        onRefetch={() => fetchSplits(expenseId)}
      />
    </Fragment>
  );
}

function ExpenseSplitItem({
  expense,
  split,
  onReviewRequestPaid,
  onMarkAsPaid
}: {
  expense: Expense | null;
  split: ExpenseSplit;
  onReviewRequestPaid?: (split: ExpenseSplit) => void;
  onMarkAsPaid?: (split: ExpenseSplit) => void;
}) {
  const { details: userDetails } = states.user();

  const isPayer = split.member.id === expense?.paid_by.id;
  const isCurrentUserPayer = expense?.paid_by.id === userDetails?.id;
  const isCurrentUserSplit = split.member.id === userDetails?.id;

  const handlePress = () => {
    if (split.status === "pending") {
      if (!isPayer && isCurrentUserPayer && onMarkAsPaid) {
        onMarkAsPaid(split);
      }
    } else {
      if (!isPayer && isCurrentUserPayer && onReviewRequestPaid) {
        onReviewRequestPaid(split);
      }
    }
  };

  if (!isCurrentUserPayer) {
    return (
      <HStack className="p-4 items-center gap-x-2 flex-1">
        <AppAvatar
          uri={split.member.avatar || undefined}
          name={split.member.first_name}
          size="md"
        />
        <VStack className="flex-1">
          <HStack className="gap-x-1 items-center">
            <Text className="text-lg">
              {split.member.first_name} {split.member.last_name}
              {isCurrentUserSplit && " (You)"}
            </Text>
          </HStack>
          <Text className="text-sm text-secondary-950">
            {split.member.email}
          </Text>
        </VStack>
        <HStack className="gap-x-2 items-center">
          <VStack className="items-end">
            <Text className="text-lg">{formatAmount(split.amount)}</Text>
            {!isPayer && <StatusBadge status={split.status} size="lg" />}
          </VStack>
        </HStack>
      </HStack>
    );
  }

  return (
    <PressableListItem className="p-4" onPress={handlePress}>
      <HStack className="items-center gap-x-2 flex-1">
        <AppAvatar
          uri={split.member.avatar || undefined}
          name={split.member.first_name}
          size="md"
        />
        <VStack className="flex-1">
          <HStack className="gap-x-1 items-center">
            <Text className="text-lg">
              {split.member.first_name} {split.member.last_name}
              {isCurrentUserSplit && " (You)"}
            </Text>
          </HStack>
          <Text className="text-sm text-secondary-950">
            {split.member.email}
          </Text>
        </VStack>
        <HStack className="gap-x-2 items-center">
          <VStack className="items-end">
            <Text className="text-lg">{formatAmount(split.amount)}</Text>
            {!isPayer && <StatusBadge status={split.status} size="lg" />}
          </VStack>
          <Icon as="chevron-right" className="text-secondary-950" />
        </HStack>
      </HStack>
    </PressableListItem>
  );
}
