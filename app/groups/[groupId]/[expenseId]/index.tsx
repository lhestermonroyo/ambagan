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
