import AppAvatar from "@/components/AppAvatar";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import TransactionSheet from "@/features/transaction/components/TransactionSheet";
import InnerLayout from "@/layouts/InnerLayout";
import services from "@/services";
import { GroupDetails, Member } from "@/types/groups";
import { Transaction } from "@/types/transactions";
import { categories } from "@/utils/constants";
import formatDate from "@/utils/formatDate";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Fragment, useMemo, useState } from "react";
import { Pressable } from "react-native";

export default function GroupDetailPage() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [loading, setLoading] = useState(true);
  const [groupDetails, setGroupDetails] = useState<GroupDetails | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentTransaction, setCurrentTransaction] =
    useState<Transaction | null>(null);

  useFocusEffect(
    useMemo(
      () => () => {
        if (!params.id) {
          router.push("/groups");
          return;
        }

        init(params.id as string);
      },
      [params.id]
    )
  );

  const init = async (groupId: string) => {
    setLoading(true);
    try {
      const [groupDetailsResponse, membersResponse, transactionResponse] =
        await Promise.all([
          services.group.getGroupById(groupId),
          services.member.getMembersByGroupId(groupId),
          services.transaction.getTransactionsByGroup(groupId)
        ]);

      if (groupDetailsResponse && membersResponse && transactionResponse) {
        setGroupDetails(groupDetailsResponse);
        setMembers(membersResponse);
        setTransactions(transactionResponse);
      }
    } catch (error) {
      console.log("Error fetching group details:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <Fragment>
      <InnerLayout title="Group Details" onBack={() => router.push("/groups")}>
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={() => (
            <VStack className="px-4 gap-y-6">
              <HStack className="gap-x-4">
                <AppAvatar
                  uri={groupDetails?.avatar || ""}
                  name={groupDetails?.name || "Group Avatar"}
                  size="lg"
                />
                <VStack className="flex-1 gap-y-2">
                  <VStack>
                    <Text bold className="text-xl" numberOfLines={3}>
                      {groupDetails?.name}
                    </Text>
                    <Text className="text-secondary-950">
                      Joined {formatDate(groupDetails?.created_at || "")} &bull;{" "}
                      {groupDetails?.members_count || 0}{" "}
                      {groupDetails?.members_count === 1 ? "member" : "members"}
                    </Text>
                  </VStack>
                  {groupDetails?.category && (
                    <Text className="text-lg self-start py-2 px-4 bg-primary-100 text-primary-800 rounded-full">
                      {
                        categories.find(
                          (cat) => cat.value === groupDetails.category
                        )?.label
                      }
                    </Text>
                  )}
                </VStack>
              </HStack>

              <HStack className="gap-x-2">
                <VStack className="flex-1 items-center">
                  <Text className="text-4xl" bold>
                    0
                  </Text>
                  <Text className="text-secondary-950">Expenses</Text>
                </VStack>
                <VStack className="flex-1 items-center">
                  <Text className="text-4xl" bold>
                    0
                  </Text>
                  <Text className="text-secondary-950">Payments</Text>
                </VStack>
                <VStack className="flex-1 items-center">
                  <Text className="text-4xl" bold>
                    0
                  </Text>
                  <Text className="text-secondary-950">Balance</Text>
                </VStack>
              </HStack>

              <HStack className="gap-x-2">
                <FormButton
                  className="flex-1"
                  variant="outline"
                  text="Edit Group"
                  icon={<Icon as="edit" className="text-primary-500" />}
                  onPress={() => router.push(`/groups/${params.id}/edit`)}
                />
                <FormButton
                  className="flex-1"
                  variant="outline"
                  text="View Members"
                  icon={<Icon as="groups" className="text-primary-500" />}
                  // onPress={() =>
                  //   router.push(`/home/group-members?groupId=${params.id}`)
                  // }
                />
              </HStack>

              <HStack>
                <Text bold className="text-xl">
                  Recent Expenses
                </Text>
              </HStack>
            </VStack>
          )}
          renderItem={({ item }) => (
            <ExpenseItem
              key={item.id}
              expense={item}
              onOpen={() => setCurrentTransaction(item)}
            />
          )}
          ItemSeparatorComponent={() => (
            <Box className="mx-4">
              <Divider className="border-secondary-100" />
            </Box>
          )}
        />
        <Box className="absolute bottom-8 right-4">
          <FormButton
            className="flex-1"
            text="Add Expense"
            icon={<Icon as="post-add" className="text-background-0" />}
            onPress={() =>
              router.push(`/home/add-expense?groupId=${params.id}`)
            }
          />
        </Box>
      </InnerLayout>
      <TransactionSheet
        transaction={currentTransaction}
        onClose={() => setCurrentTransaction(null)}
      />
    </Fragment>
  );
}

function ExpenseItem({
  expense,
  onOpen
}: {
  expense: Transaction;
  onOpen: () => void;
}) {
  return (
    <Pressable onPress={onOpen}>
      <HStack className="justify-between items-center py-3 px-4 rounded-lg">
        <VStack className="flex-1">
          <Text className="text-lg" numberOfLines={2} ellipsizeMode="tail">
            {expense.description}
          </Text>
          <Text className="text-secondary-950">
            Paid by {expense.paid_by.first_name}
          </Text>
        </VStack>
        <VStack>
          <Text
            className={`text-lg text-right ${
              expense.type === "expense" ? "text-red-500" : "text-green-500"
            }`}
          >
            {expense.type === "expense" ? "-" : "+"}₱{expense.amount.toFixed(2)}
          </Text>
          <Text className="text-secondary-950 text-right">
            {formatDate(expense.created_at)}
          </Text>
        </VStack>
      </HStack>
    </Pressable>
  );
}
