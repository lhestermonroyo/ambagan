import AppAvatar from "@/components/AppAvatar";
import ConfirmIconButton from "@/components/ConfirmIconButton";
import FormButton from "@/components/FormButton";
import LoadingWrapper from "@/components/LoadingWrapper";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import ImageViewerSheet from "@/features/expense/components/ImageViewerSheet";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import useAppToast from "@/hooks/use-app-toast";
import InnerLayout from "@/layouts/InnerLayout";
import services from "@/services";
import states from "@/states";
import { ExpensePayer, MemberSplit, Payment } from "@/types/expenses";
import { formatDate } from "@/utils/formatDate";
import { getPrimaryHex } from "@/utils/getColorHex";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { FileImage } from "lucide-react-native";
import { Fragment, ReactNode, useMemo, useState } from "react";
import { useColorScheme } from "react-native";

export default function ExpenseDetailsScreen() {
  const { details: groupDetails } = states.group();
  const {
    details: expenseDetails,
    payerList,
    memberSplitList,
    paymentSplitList
  } = states.expense();
  const { details: userDetails } = states.user();

  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const params = useLocalSearchParams();
  const expenseId = params.expenseId as string;
  const groupId = params.groupId as string;

  const toast = useAppToast();
  const [imageViewerOpen, setImageViewerOpen] = useState(false);

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
    const requests: Promise<void>[] = [
      fetchExpenseDetails(expenseId),
      fetchPayers(expenseId),
      fetchMemberSplits(expenseId),
      fetchPayments(expenseId)
    ];

    if (!groupDetails) {
      requests.push(fetchGroupDetails(groupId));
    }

    await Promise.all(requests);
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
        details: { ...prev, ...response }
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
      states.expense.setState((prev) => ({ ...prev, details: response }));
    } catch (error) {
      console.log("Error fetching expense details:", error);
    }
  };

  const fetchPayers = async (expenseId: string) => {
    try {
      const response = await services.expense.getPayersByExpenseId(expenseId);
      if (!response) return;
      states.expense.setState((prev) => ({ ...prev, payerList: response }));
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

  const isPayer = useMemo(
    () => payerList.some((payer) => payer.payer.id === userDetails?.id),
    [payerList, userDetails]
  );

  const memberPaymentMap = useMemo(() => {
    const map: Record<string, Payment> = {};
    paymentSplitList.forEach((p) => {
      const existing = map[p.member.id];
      if (!existing || p.status !== "settled") {
        map[p.member.id] = p;
      }
    });
    return map;
  }, [paymentSplitList]);

  return (
    <Fragment>
      <InnerLayout
        title="Expense Details"
        onBack={handleBack}
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
            {expenseDetails && (
              <VStack className="gap-y-6 pb-2">
                <VStack className="w-full gap-y-1 px-4">
                  <Text className="text-3xl" bold>
                    {formatAmount(
                      expenseDetails.amount,
                      expenseDetails.currency
                    )}
                  </Text>
                  <Text className="text-lg text-secondary-950">
                    {expenseDetails.description}
                  </Text>
                </VStack>

                <VStack className="gap-y-2">
                  <Box className="bg-secondary-100 mx-4 rounded-xl overflow-hidden">
                    <DetailRow
                      label="Expense Date"
                      value={
                        <Text>{formatDate(expenseDetails.created_at)}</Text>
                      }
                    />
                    <DetailRow
                      label="Created By"
                      value={
                        <HStack className="gap-x-2 items-center">
                          <AppAvatar
                            name={`${expenseDetails.creator.first_name} ${expenseDetails.creator.last_name}`}
                            uri={expenseDetails.creator.avatar!}
                            size="sm"
                          />
                          <Text>
                            {expenseDetails.creator.first_name}{" "}
                            {expenseDetails.creator.last_name}
                            {expenseDetails.creator.id === userDetails?.id &&
                              " (You)"}
                          </Text>
                        </HStack>
                      }
                    />
                    <DetailRow
                      label="Split Type"
                      value={
                        <Text className="capitalize">
                          {expenseDetails.split_type}
                        </Text>
                      }
                    />
                    <DetailRow
                      label="Proof of Payment"
                      value={
                        expenseDetails.proof_of_payment ? (
                          <FormButton
                            size="md"
                            variant="outline"
                            text="View Image"
                            icon={
                              <FileImage
                                size={18}
                                color={getPrimaryHex(
                                  "text-primary-500",
                                  colorScheme
                                )}
                              />
                            }
                            onPress={() => setImageViewerOpen(true)}
                          />
                        ) : (
                          <Text className="text-secondary-950">N/A</Text>
                        )
                      }
                    />
                  </Box>
                </VStack>

                <VStack className="gap-y-2">
                  <Text className="text-xl px-4" bold>
                    Members Split
                  </Text>
                  <FlatList
                    className="flex-1"
                    scrollEnabled={false}
                    data={memberSplitList}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                      <MemberSplitItem
                        memberSplit={item}
                        payment={memberPaymentMap[item.member.id]}
                      />
                    )}
                    ItemSeparatorComponent={() => (
                      <Box className="mx-4">
                        <Divider className="border-secondary-100" />
                      </Box>
                    )}
                  />
                </VStack>

                <VStack className="gap-y-2">
                  <Text className="text-xl px-4" bold>
                    Payers' Contribution
                  </Text>
                  <FlatList
                    className="flex-1"
                    scrollEnabled={false}
                    data={payerList}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => <PayerItem payer={item} />}
                    ItemSeparatorComponent={() => (
                      <Box className="mx-4">
                        <Divider className="border-secondary-100" />
                      </Box>
                    )}
                  />
                </VStack>
              </VStack>
            )}
          </ScrollView>
        </LoadingWrapper>
      </InnerLayout>

      <ImageViewerSheet
        isOpen={imageViewerOpen}
        onClose={() => setImageViewerOpen(false)}
        uri={expenseDetails?.proof_of_payment ?? null}
        title="Proof of Payment"
      />
    </Fragment>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <HStack className="items-center justify-between p-4">
      <Text className="text-secondary-950">{label}</Text>
      {value}
    </HStack>
  );
}

function MemberSplitItem({
  memberSplit,
  payment
}: {
  memberSplit: MemberSplit;
  payment?: Payment;
}) {
  const { details: userDetails } = states.user();
  const isMe = memberSplit.member.id === userDetails?.id;

  return (
    <HStack className="p-4 gap-x-2 items-center">
      <AppAvatar
        name={memberSplit.member.first_name}
        uri={memberSplit.member.avatar!}
        size="md"
      />
      <VStack className="flex-1">
        <Text className="text-lg">
          {memberSplit.member.first_name} {memberSplit.member.last_name}
          {isMe && " (You)"}
        </Text>
        <Text className="text-secondary-950">{memberSplit.member.email}</Text>
      </VStack>
      <VStack className="items-end gap-y-1">
        <Text className="text-lg">
          {formatAmount(memberSplit.amount, memberSplit.currency)}
        </Text>
      </VStack>
    </HStack>
  );
}

function PayerItem({ payer }: { payer: ExpensePayer }) {
  const { details: userDetails } = states.user();
  const isMe = payer.payer.id === userDetails?.id;

  return (
    <HStack className="p-4 items-center justify-between">
      <HStack className="gap-x-2 items-center flex-1">
        <AppAvatar
          name={payer.payer.first_name}
          uri={payer.payer.avatar!}
          size="md"
        />
        <VStack>
          <Text className="text-lg">
            {payer.payer.first_name} {payer.payer.last_name}
            {isMe && " (You)"}
          </Text>
          <Text className="text-secondary-950">{payer.payer.email}</Text>
        </VStack>
      </HStack>
      <Text className="text-lg">
        {formatAmount(payer.amount, payer.currency)}
      </Text>
    </HStack>
  );
}
