import AppAvatar from "@/components/AppAvatar";
import AppBadge from "@/components/AppBadge";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import LoadingWrapper from "@/components/LoadingWrapper";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import RequestPaidSheet from "@/features/transaction/components/RequestPaidSheet";
import InnerLayout from "@/layouts/InnerLayout";
import services from "@/services";
import states from "@/states";
import { MemberSplit, Transaction } from "@/types/transactions";
import formatDate from "@/utils/formatDate";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Fragment, useMemo, useState } from "react";

const expenseDetailsTabTypes = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Paid", value: "paid" },
  { label: "You", value: "you" }
];

export default function ExpenseDetailsScreen() {
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<string>(expenseDetailsTabTypes[0].value);
  const [splits, setSplits] = useState<MemberSplit[]>([]);
  const [transaction, setTransaction] = useState<Transaction | null>(null);

  const user = states.user.getState();
  const group = states.group.getState();
  const { details: groupDetails } = group;
  const { details: userDetails } = user;

  const router = useRouter();
  const params = useLocalSearchParams();
  const transactionId = params.transactionId as string;

  useFocusEffect(
    useMemo(
      () => () => {
        if (!transactionId) {
          return router.push(`/groups/${params.id}`);
        }

        const currentTransaction = groupDetails?.expenses.find(
          (t) => t.id === transactionId
        );

        if (!currentTransaction) {
          return router.push(`/groups/${params.id}`);
        }

        setTransaction(currentTransaction || null);
        fetchSplits(transactionId);
      },
      [transactionId]
    )
  );

  const fetchSplits = async (transactionId: string) => {
    setLoading(true);

    
      const response =
        await services.transaction.getSplitsByTransaction(transactionId);

      if (!response) return;

      setSplits(response);
    } catch (error) {
      console.log("Error fetching transaction details:", error);
    } finally {
      setLoading(false);
    }
  };

  const formattedSplits = useMemo(() => {
    const payerIndex = splits.findIndex(
      (split) => split.member.id === transaction?.paid_by.id
    );

    if (payerIndex === -1) return splits;

    const payerSplit = splits[payerIndex];
    const otherSplits = splits.filter((_, index) => index !== payerIndex);

    if (userDetails?.id !== transaction?.paid_by.id) {
      const currentUserIndex = otherSplits.findIndex(
        (split) => split.member.id === userDetails?.id
      );

      if (currentUserIndex !== -1) {
        const currentUserSplit = otherSplits[currentUserIndex];
        otherSplits.splice(currentUserIndex, 1);
        return [payerSplit, currentUserSplit, ...otherSplits];
      }
    }

    return [payerSplit, ...otherSplits];
  }, [splits, tab]);

  const isCurrentUserPayer = transaction?.paid_by.id === userDetails?.id;
  const theyOweYouAmount =
    useMemo(() => {
      if (!transaction) return 0;

      const totalOwed = splits.reduce((total, split) => {
        if (split.member.id !== transaction.paid_by.id) {
          return total + split.amount;
        }
        return total;
      }, 0);

      return totalOwed;
    }, [splits, transaction]) || 0;
  const youOweAmount =
    useMemo(() => {
      if (!transaction || !userDetails) return 0;

      const userSplit = splits.find(
        (split) => split.member.id === userDetails.id
      );

      return userSplit ? userSplit.amount : 0;
    }, [splits, transaction, userDetails]) || 0;

  return (
    <InnerLayout
      title="Expense Details"
      onBack={() => router.push(`/groups/${params.id}`)}
    >
      <LoadingWrapper
        isLoading={loading}
        text="Loading expense details, please wait..."
      >
        <FlatList
          className="flex-1"
          data={formattedSplits}
          keyExtractor={(item) => item.member.id}
          renderItem={({ item }) => (
            <SplitItem
              key={item.member.id}
              transaction={transaction}
              split={item}
            />
          )}
          ItemSeparatorComponent={() => (
            <Box className="mx-4">
              <Divider className="border-secondary-100" />
            </Box>
          )}
          ListHeaderComponent={() => (
            <VStack className="gap-y-6 pb-4">
              <VStack className="w-full gap-y-6 px-4">
                <VStack className="items-center">
                  <Text className="text-xl" bold>
                    {transaction?.description}
                  </Text>
                  <HStack className="gap-x-1 items-center">
                    <Text className="text-secondary-950 text-sm">Paid by</Text>
                    <AppAvatar
                      name={transaction?.paid_by.first_name || ""}
                      uri={transaction?.paid_by.avatar || ""}
                      size="xs"
                    />
                    <Text className="text-secondary-950 text-sm">
                      {transaction?.paid_by.first_name}{" "}
                      {transaction?.paid_by.last_name}
                    </Text>
                    <Text>&bull;</Text>
                    <Text className="text-secondary-950 text-sm">
                      {formatDate(transaction?.created_at || "")}
                    </Text>
                  </HStack>
                </VStack>
                <HStack className="gap-x-4 items-center">
                  <VStack className="flex-1 items-center">
                    <Text className="text-2xl" bold>
                      ₱{transaction?.amount.toFixed(2)}
                    </Text>
                    <Text className="text-secondary-950 text-sm">
                      Total Amount
                    </Text>
                  </VStack>
                  {isCurrentUserPayer && (
                    <VStack className="flex-1 items-center">
                      <Text className="text-2xl" bold>
                        ₱{theyOweYouAmount.toFixed(2)}
                      </Text>
                      <Text className="text-secondary-950 text-sm">
                        They owe you
                      </Text>
                    </VStack>
                  )}
                  {!isCurrentUserPayer && (
                    <VStack className="flex-1 items-center">
                      <Text className="text-2xl" bold>
                        ₱{youOweAmount.toFixed(2)}
                      </Text>
                      <Text className="text-secondary-950">You owe</Text>
                    </VStack>
                  )}
                </HStack>
              </VStack>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <HStack className="gap-x-2 px-4">
                  {expenseDetailsTabTypes.map((type) => (
                    <FormButton
                      key={type.value}
                      variant={type.value === tab ? "solid" : "outline"}
                      className="flex-1 h-10"
                      size="md"
                      text={type.label}
                      onPress={() => setTab(type.value)}
                    />
                  ))}
                </HStack>
              </ScrollView>
            </VStack>
          )}
        />
      </LoadingWrapper>
    </InnerLayout>
  );
}

function SplitItem({
  transaction,
  split
}: {
  transaction: Transaction | null;
  split: MemberSplit;
}) {
  const [requestPaidSplitMember, setRequestPaidSplitMember] =
    useState<MemberSplit | null>(null);

  const user = states.user.getState();
  const userDetails = user?.details;

  const isPayer = split.member.id === transaction?.paid_by.id;
  const isCurrentUserPayer = transaction?.paid_by.id === userDetails?.id;
  const isCurrentUserSplit = split.member.id === userDetails?.id;

  return (
    <Fragment>
      <HStack className="p-4">
        <HStack className="gap-x-2 flex-1">
          <VStack className="items-center" style={{ width: 92 }}>
            <AppAvatar
              name={split.member.first_name}
              uri={split.member.avatar || ""}
            />
            <Text>
              {split.member.first_name} {split.member.last_name}
            </Text>
          </VStack>
          <VStack className="flex-1 gap-y-4 items-center">
            <VStack className="items-center gap-y-0">
              <Text className="text-xl" bold>
                ₱{split.amount.toFixed(2)}
              </Text>
              <Icon as="arrow-right-alt" className="text-secondary-950" />
              {isPayer ? (
                <AppBadge text="Payer" action="success" />
              ) : (
                <Fragment>
                  {split.status === "paid" ? (
                    <AppBadge text="Paid" action="success" />
                  ) : (
                    <AppBadge text="Pending" action="warning" />
                  )}
                </Fragment>
              )}
            </VStack>
            {split.status === "pending" ? (
              <VStack className="items-center">
                {!isPayer && isCurrentUserSplit && (
                  <FormButton
                    text="Request as Paid"
                    icon={
                      <Icon
                        as="check-circle-outline"
                        className="text-background-0"
                      />
                    }
                    onPress={() => setRequestPaidSplitMember(split)}
                  />
                )}
                {!isPayer && isCurrentUserPayer && (
                  <FormButton
                    text="Mark as Paid"
                    icon={
                      <Icon
                        as="check-circle-outline"
                        className="text-background-0"
                      />
                    }
                  />
                )}
              </VStack>
            ) : (
              <VStack className="items-center">
                {!isPayer && isCurrentUserSplit && (
                  <FormButton
                    text="Undo Paid"
                    variant="outline"
                    icon={<Icon as="refresh" className="text-primary-400" />}
                  />
                )}
              </VStack>
            )}
          </VStack>

          <VStack className="items-center" style={{ width: 92 }}>
            <AppAvatar
              name={transaction?.paid_by.first_name || ""}
              uri={transaction?.paid_by.avatar || ""}
            />
            <Text>
              {transaction?.paid_by.first_name} {transaction?.paid_by.last_name}
            </Text>
          </VStack>
        </HStack>
      </HStack>
      <RequestPaidSheet
        isOpen={!!requestPaidSplitMember}
        onClose={() => setRequestPaidSplitMember(null)}
        splitMember={requestPaidSplitMember as MemberSplit}
      />
    </Fragment>
  );
}
