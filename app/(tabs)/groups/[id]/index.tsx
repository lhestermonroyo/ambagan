import AppAvatar from "@/components/AppAvatar";
import AppAvatarGroup from "@/components/AppAvatarGroup";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import LoadingWrapper from "@/components/LoadingWrapper";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
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
    try {
      setLoading(true);

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
      router.push("/groups");
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

  const avatarGroupItems = useMemo(
    () =>
      (group.details?.members ?? []).map((member) => ({
        id: member.id,
        avatar: member.avatar ?? null,
        name: member.first_name || "Member"
      })),
    [group.details?.members]
  );

  return (
    <Fragment>
      <InnerLayout
        title="Group Details"
        onBack={handleBack}
        actions={[
          <Button
            variant="link"
            className="rounded-full"
            onPress={() => router.push(`/groups/${params.id}/edit`)}
          >
            <Icon as="edit" size={28} className="text-secondary-950" />
          </Button>
        ]}
      >
        <LoadingWrapper
          isLoading={loading}
          text="Loading group details, please wait..."
        >
          <FlatList
            data={group.details?.expenses}
            keyExtractor={(item) => item.id}
            renderItem={({ item }: { item: Transaction | Member }) => (
              <ExpenseItem
                key={item.id}
                expense={item as Transaction}
                onOpen={() =>
                  router.push(
                    `/groups/${params.id}/expense-details?transactionId=${item.id}`
                  )
                }
              />
            )}
            ItemSeparatorComponent={() => (
              <Box className="mx-4">
                <Divider className="border-secondary-100" />
              </Box>
            )}
            ListEmptyComponent={() => (
              <VStack className="flex-1 justify-center items-center py-4">
                <Text className="text-secondary-950">
                  No expenses recorded yet.
                </Text>
              </VStack>
            )}
            ListHeaderComponent={() => (
              <VStack className="px-4 pb-4 gap-y-6">
                <AppAvatar
                  className="self-center"
                  uri={group.details?.avatar || ""}
                  name={group.details?.name || "Group Avatar"}
                  size="xl"
                />

                <VStack className="items-center">
                  <Text bold className="text-xl" numberOfLines={3}>
                    {group.details?.name}
                  </Text>
                  <HStack className="gap-x-1">
                    <Text className="text-secondary-950 text-sm">
                      Joined {formatDate(group.details?.created_at || "")}
                    </Text>
                    <Text>&bull;</Text>
                    <Text className="text-xs self-start py-1 px-2 bg-primary-100 text-primary-800 rounded-full">
                      {
                        categories.find(
                          (cat) => cat.value === group.details?.category
                        )?.label
                      }
                    </Text>
                  </HStack>
                </VStack>

                <VStack className="items-center gap-y-4">
                  <AppAvatarGroup
                    items={avatarGroupItems}
                    size="sm"
                    maxDisplay={4}
                  />
                  <FormButton
                    variant="outline"
                    text="View Members"
                    iconEnd={
                      <Icon as="chevron-right" className="text-primary-500" />
                    }
                    size="md"
                    onPress={() => router.push(`/groups/${params.id}/members`)}
                  />
                </VStack>

                <VStack className="items-start">
                  <Text bold className="text-xl">
                    Expenses
                  </Text>
                </VStack>
              </VStack>
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
        </LoadingWrapper>
      </InnerLayout>
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
          <HStack className="gap-x-1 items-center">
            <Text className="text-secondary-950 text-sm">Paid by</Text>
            <AppAvatar
              name={expense.paid_by.first_name}
              uri={expense.paid_by.avatar || ""}
              size="xs"
            />
            <Text className="text-secondary-950 text-sm">
              {expense.paid_by.first_name} {expense.paid_by.last_name}
            </Text>
          </HStack>
        </VStack>
        <VStack>
          <Text className="text-lg text-right">
            ₱{expense.amount.toFixed(2)}
          </Text>
          <Text className="text-secondary-950 text-right text-sm">
            {formatDate(expense.created_at)}
          </Text>
        </VStack>
      </HStack>
    </Pressable>
  );
}
