import ConfirmIconButton from "@/components/ConfirmIconButton";
import LoadingWrapper from "@/components/LoadingWrapper";
import { ScrollView } from "@/components/ui/scroll-view";
import MemberExpenseDetails from "@/features/expense/components/MemberExpenseDetails";
import PayerExpenseDetails from "@/features/expense/components/PayerExpenseDetails";
import useAppToast from "@/hooks/use-app-toast";
import InnerLayout from "@/layouts/InnerLayout";
import services from "@/services";
import states from "@/states";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Fragment, useMemo } from "react";

export default function ExpenseDetailsScreen() {
  const user = states.user();
  const { details: groupDetails } = states.group();
  const {
    details: expenseDetails,
    payerList,
    memberSplitList,
    paymentSplitList
  } = states.expense();
  const { details: userDetails } = user;

  const router = useRouter();
  const params = useLocalSearchParams();
  const expenseId = params.expenseId as string;
  const groupId = params.groupId as string;

  const toast = useAppToast();

  useFocusEffect(
    useMemo(
      () => () => {
        if (!expenseId || !groupId) {
          return router.push(`/groups/${groupId}`);
        }

        init(groupId, expenseId);
      },
      [expenseId, groupId]
    )
  );

  const init = async (groupId: string, expenseId: string) => {
    const requests = [
      fetchExpenseDetails(expenseId),
      fetchPayers(expenseId),
      fetchMemberSplits(expenseId)
    ];

    if (!groupDetails) {
      requests.push(fetchGroupDetails(groupId));
    }
    await Promise.all(requests);

    const { payerList: updatedPayerList } = states.expense.getState();
    const isUserPayer = updatedPayerList.some(
      (p) => p.payer.id === userDetails?.id
    );

    if (isUserPayer) {
      await fetchPayments(expenseId);
    } else {
      await fetchMyPayments(expenseId);
    }
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
    try {
      const response = await services.expense.getExpenseById(expenseId);

      if (!response) return;

      states.expense.setState((prev) => ({
        ...prev,
        details: response
      }));
    } catch (error) {
      console.log("Error fetching expense details:", error);
    }
  };

  const fetchPayers = async (expenseId: string) => {
    try {
      const response = await services.expense.getPayersByExpenseId(expenseId);

      if (!response) return;

      states.expense.setState((prev) => ({
        ...prev,
        payerList: response
      }));
    } catch (error) {
      console.log("Error fetching payers:", error);
    }
  };

  const fetchMemberSplits = async (expenseId: string) => {
    try {
      const response =
        await services.expense.getMemberSplitsByExpenseId(expenseId);

      if (!response) return;

      states.expense.setState((prev) => ({
        ...prev,
        memberSplitList: response
      }));
    } catch (error) {
      console.log("Error fetching member splits:", error);
    }
  };

  const fetchPayments = async (expenseId: string) => {
    try {
      const response = await services.expense.getPaymentsByExpenseId(expenseId);

      if (!response) return;

      states.expense.setState((prev) => ({
        ...prev,
        paymentSplitList: response
      }));
    } catch (error) {
      console.log("Error fetching payments:", error);
    }
  };

  const fetchMyPayments = async (expenseId: string) => {
    try {
      const response = await services.expense.getPaymentsByExpenseId(expenseId);

      if (!response) return;

      states.expense.setState((prev) => ({
        ...prev,
        paymentSplitList: response
      }));
    } catch (error) {
      console.log("Error fetching my payments:", error);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      const deleteResponse = await services.expense.deleteExpense(expenseId);

      if (deleteResponse.success) {
        toast({
          title: "Expense Deleted",
          description: "Expense deleted successfully.",
          type: "success"
        });
        states.expense.setState((prev) => ({
          ...prev,
          details: null,
          payerList: [],
          memberSplitList: [],
          paymentSplitList: []
        }));
        router.push(`/groups/${groupId}`);
      }
    } catch (error) {
      console.log("Error deleting expense:", error);
      toast({
        title: "Error",
        description: "Failed to delete expense. Please try again.",
        type: "error"
      });
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

  // const handleOpenReviewRequestPaidSheet = (payment: Payment) => {
  //   setReviewRequestPaidSheet({ open: true });
  // };

  // const handleOpenMarkAsPaidSheet = (split: ExpenseSplit) => {
  //   setMarkAsPaidSheet({ open: true, split });
  // };

  const handleBack = () => {
    states.expense.setState((prev) => ({
      ...prev,
      details: null,
      payerList: [],
      memberSplitList: [],
      paymentSplitList: []
    }));
    router.back();
  };

  const isPayer = useMemo(() => {
    return payerList.some((payer) => payer.payer.id === userDetails?.id);
  }, [payerList, userDetails]);

  // const formattedSplits = useMemo(() => {
  //   const payerIndex = splits.findIndex(
  //     (split) => split.member.id === expense?.paid_by.id
  //   );
  //   const currentUserIndex = splits.findIndex(
  //     (split) => split.member.id === userDetails?.id
  //   );

  //   if (payerIndex === -1 && currentUserIndex === -1) return splits;

  //   const payerSplit = payerIndex !== -1 ? splits[payerIndex] : null;
  //   const currentUserSplit =
  //     currentUserIndex !== -1 ? splits[currentUserIndex] : null;
  //   const otherSplits = splits.filter(
  //     (_, index) => index !== payerIndex && index !== currentUserIndex
  //   );

  //   const result: ExpenseSplit[] = [];
  //   if (payerSplit) result.push(payerSplit);
  //   if (currentUserSplit && currentUserIndex !== payerIndex)
  //     result.push(currentUserSplit);
  //   return [...result, ...otherSplits];
  // }, [expenseId, splits, userDetails, expense, isCurrentUserPayer]);

  // const payerStats =
  //   useMemo(() => {
  //     if (!isCurrentUserPayer || !expense) return null;

  //     const totalPaid = splits.reduce((total, split) => {
  //       if (split.member.id !== expense.paid_by.id && split.status === "paid") {
  //         return total + split.amount;
  //       }
  //       return total;
  //     }, 0);
  //     const theyOweYouAmount = splits.reduce((total, split) => {
  //       if (split.member.id !== expense.paid_by.id && split.status !== "paid") {
  //         return total + split.amount;
  //       }
  //       return total;
  //     }, 0);

  //     return {
  //       totalPaid,
  //       theyOweYouAmount
  //     };
  //   }, [splits, expense, isCurrentUserPayer]) || null;

  return (
    <Fragment>
      <InnerLayout
        title="Expense Details"
        onBack={() => handleBack()}
        actions={[
          isPayer && (
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
            !expenseDetails || !groupDetails || !payerList || !memberSplitList
          }
          text="Loading expense details, please wait..."
        >
          <ScrollView className="flex-1" bounces={false}>
            {isPayer ? (
              <PayerExpenseDetails onRefetch={() => fetchPayments(expenseId)} />
            ) : (
              <MemberExpenseDetails
                onRefetch={() => fetchPayments(expenseId)}
              />
            )}
          </ScrollView>
        </LoadingWrapper>
      </InnerLayout>
    </Fragment>
  );
}

// function ExpenseSplitItem({
//   expense,
//   split,
//   onReviewRequestPaid,
//   onMarkAsPaid
// }: {
//   expense: Expense | null;
//   split: ExpenseSplit;
//   onReviewRequestPaid?: (split: ExpenseSplit) => void;
//   onMarkAsPaid?: (split: ExpenseSplit) => void;
// }) {
//   const { details: userDetails } = states.user();

//   const isPayer = split.member.id === expense?.paid_by.id;
//   const isCurrentUserPayer = expense?.paid_by.id === userDetails?.id;
//   const isCurrentUserSplit = split.member.id === userDetails?.id;

//   const handlePress = () => {
//     if (split.status === "pending") {
//       if (!isPayer && isCurrentUserPayer && onMarkAsPaid) {
//         onMarkAsPaid(split);
//       }
//     } else {
//       if (!isPayer && isCurrentUserPayer && onReviewRequestPaid) {
//         onReviewRequestPaid(split);
//       }
//     }
//   };

//   if (!isCurrentUserPayer) {
//     return (
//       <HStack className="p-4 items-center gap-x-2 flex-1">
//         <AppAvatar
//           uri={split.member.avatar || undefined}
//           name={split.member.first_name}
//           size="md"
//         />
//         <VStack className="flex-1">
//           <HStack className="gap-x-1 items-center">
//             <Text className="text-lg">
//               {split.member.first_name} {split.member.last_name}
//               {isCurrentUserSplit && " (You)"}
//             </Text>
//           </HStack>
//           <Text className="text-sm text-secondary-950">
//             {split.member.email}
//           </Text>
//         </VStack>
//         <HStack className="gap-x-2 items-center">
//           <VStack className="items-end">
//             <Text className="text-lg">{formatAmount(split.amount)}</Text>
//             {!isPayer && <StatusBadge status={split.status} size="lg" />}
//           </VStack>
//         </HStack>
//       </HStack>
//     );
//   }

//   return (
//     <PressableListItem className="p-4" onPress={handlePress}>
//       <HStack className="items-center gap-x-2 flex-1">
//         <AppAvatar
//           uri={split.member.avatar || undefined}
//           name={split.member.first_name}
//           size="md"
//         />
//         <VStack className="flex-1">
//           <HStack className="gap-x-1 items-center">
//             <Text className="text-lg">
//               {split.member.first_name} {split.member.last_name}
//               {isCurrentUserSplit && " (You)"}
//             </Text>
//           </HStack>
//           <Text className="text-sm text-secondary-950">
//             {split.member.email}
//           </Text>
//         </VStack>
//         <HStack className="gap-x-2 items-center">
//           <VStack className="items-end">
//             <Text className="text-lg">{formatAmount(split.amount)}</Text>
//             {!isPayer && <StatusBadge status={split.status} size="lg" />}
//           </VStack>
//           <Icon as="chevron-right" className="text-secondary-950" />
//         </HStack>
//       </HStack>
//     </PressableListItem>
//   );
// }
