import AppAvatar from "@/components/AppAvatar";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import SearchInput from "@/components/SearchInput";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { Menu, MenuItem, MenuItemLabel } from "@/components/ui/menu";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import TransactionSheet from "@/features/transaction/components/ExpenseDetailsSheet";
import InnerLayout from "@/layouts/InnerLayout";
import services from "@/services";
import states from "@/states";
import { Member } from "@/types/groups";
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentTransaction, setCurrentTransaction] =
    useState<Transaction | null>(null);

  const group = states.group.getState();

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
        states.group.setState((prev) => ({
          ...prev,
          details: {
            ...groupDetailsResponse,
            members: membersResponse,
            expenses: transactionResponse
          }
        }));
      }
    } catch (error) {
      console.log("Error fetching group details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    states.group.setState((prev) => ({
      ...prev,
      details: null
    }));
    router.push("/groups");
  };

  if (loading) {
    return null;
  }

  return (
    <Fragment>
      <InnerLayout
        title="Group Details"
        onBack={handleBack}
        actions={[
          <>
            <Menu
              isOpen={isMenuOpen}
              placement="bottom right"
              closeOnSelect
              trigger={({ ...triggerProps }) => (
                <Button
                  variant="link"
                  className="rounded-full"
                  {...triggerProps}
                  onPress={() => setIsMenuOpen(true)}
                >
                  <Icon
                    as="more-vert"
                    size={28}
                    className="text-secondary-950"
                  />
                </Button>
              )}
              onClose={() => setIsMenuOpen(false)}
            >
              <MenuItem
                textValue="edit-group"
                onPress={() => {
                  setIsMenuOpen(false);
                  router.push(`/groups/${params.id}/edit`);
                }}
              >
                <HStack className="gap-x-2 items-center">
                  <Icon as="edit" className="text-primary-500" />
                  <MenuItemLabel>Edit Group</MenuItemLabel>
                </HStack>
              </MenuItem>
              <MenuItem
                textValue="view-members"
                onPress={() => {
                  setIsMenuOpen(false);
                  router.push(`/groups/${params.id}/members`);
                }}
              >
                <HStack className="gap-x-2 items-center">
                  <Icon as="groups" className="text-primary-500" />
                  <MenuItemLabel>Members</MenuItemLabel>
                </HStack>
              </MenuItem>
            </Menu>
          </>
        ]}
      >
        <FlatList
          data={group.details?.expenses}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={() => (
            <VStack className="px-4 pb-4 gap-y-6">
              <HStack className="gap-x-4">
                <AppAvatar
                  uri={group.details?.avatar || ""}
                  name={group.details?.name || "Group Avatar"}
                  size="lg"
                />
                <VStack className="flex-1 gap-y-2">
                  <VStack>
                    <Text bold className="text-xl" numberOfLines={3}>
                      {group.details?.name}
                    </Text>
                    <Text className="text-secondary-950">
                      Joined {formatDate(group.details?.created_at || "")}{" "}
                      &bull; {group.details?.members_count || 0}{" "}
                      {group.details?.members_count === 1
                        ? "member"
                        : "members"}
                    </Text>
                  </VStack>
                  {group.details?.category && (
                    <Text className="text-lg self-start py-2 px-4 bg-primary-100 text-primary-800 rounded-full">
                      {
                        categories.find(
                          (cat) => cat.value === group.details?.category
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

              <VStack className="flex-1 gap-x-2 items-center">
                <SearchInput
                  placeholder="Search expenses"
                  className="flex-1"
                  onChangeText={() => {}}
                  value=""
                />
              </VStack>
            </VStack>
          )}
          renderItem={({ item }: { item: Transaction | Member }) => (
            <ExpenseItem
              key={item.id}
              expense={item as Transaction}
              onOpen={() => setCurrentTransaction(item as Transaction)}
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
          <HStack className="gap-x-1">
            <Text className="text-secondary-950">Paid by</Text>
            <AppAvatar
              name={expense.paid_by.first_name}
              uri={expense.paid_by.avatar || ""}
              size="xs"
            />
            <Text className="text-secondary-950">
              {expense.paid_by.first_name} {expense.paid_by.last_name}
            </Text>
          </HStack>
        </VStack>
        <VStack>
          <Text className="text-lg text-right">
            ₱{expense.amount.toFixed(2)}
          </Text>
          <Text className="text-secondary-950 text-right">
            {formatDate(expense.created_at)}
          </Text>
        </VStack>
      </HStack>
    </Pressable>
  );
}
