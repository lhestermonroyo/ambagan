import AppAvatar from "@/components/AppAvatar";
import AppAvatarGroup from "@/components/AppAvatarGroup";
import ConfirmIconButton from "@/components/ConfirmIconButton";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import LoadingWrapper from "@/components/LoadingWrapper";
import PressableListItem from "@/components/PressableListItem";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { Fab, FabLabel } from "@/components/ui/fab";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import InnerLayout from "@/layouts/InnerLayout";
import services from "@/services";
import states from "@/states";
import { Expense } from "@/types/expenses";
import { categories } from "@/utils/constants";
import { formatDate, getDateGroupTitle } from "@/utils/formatDate";
import { format, parseISO } from "date-fns";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { SwipeListView } from "react-native-swipe-list-view";

export default function GroupDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const groupId = params.groupId as string | undefined;
  const [loading, setLoading] = useState(true);

  const { details: groupDetails } = states.group();
  const { details: userDetails } = states.user();

  useFocusEffect(
    useMemo(
      () => () => {
        if (!groupId) {
          router.push("/groups");
          return;
        }

        const initialized = groupDetails?.id === groupId;
        init(groupId, initialized);
      },
      [groupId, groupDetails]
    )
  );

  const init = async (groupId: string, initialized = false) => {
    if (!initialized) {
      setLoading(true);
    }

    try {
      const [groupDetailsResponse, membersResponse, expensesResponse] =
        await Promise.all([
          services.group.getGroupById(groupId),
          services.member.getMembersByGroupId(groupId),
          services.expense.getExpensesByGroup(groupId)
        ]);

      if (!groupDetailsResponse || !membersResponse || !expensesResponse) {
        router.push("/groups");
        return;
      }

      states.group.setState((prev) => ({
        ...prev,
        details: {
          ...groupDetailsResponse,
          members: membersResponse,
          expenses: expensesResponse
        }
      }));
    } catch (error) {
      console.log("Error fetching group details:", error);
      router.push("/groups");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      const deleteResponse = await services.expense.deleteExpense(expenseId);

      if (deleteResponse.success) {
        init(groupId!, true);
      }
    } catch (error) {
      console.log("Error deleting expense:", error);
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
      (groupDetails?.members ?? []).map((member) => ({
        id: member.id,
        avatar: member.avatar ?? null,
        name: member.first_name || "Member"
      })),
    [groupDetails?.members]
  );

  const formattedExpenseList = useMemo(() => {
    const expenseList = groupDetails?.expenses ?? [];

    const groupedByDate: { [key: string]: typeof expenseList } = {};

    expenseList.forEach((item) => {
      const createdAt = item.created_at || new Date().toISOString();
      const dateKey = format(parseISO(createdAt), "yyyy-MM-dd");

      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = [];
      }
      groupedByDate[dateKey].push(item);
    });

    const sections = Object.keys(groupedByDate)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .map((dateKey) => ({
        title: getDateGroupTitle(dateKey + "T00:00:00"),
        data: groupedByDate[dateKey].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      }));

    return sections;
  }, [groupDetails?.expenses]);

  return (
    <InnerLayout
      title="Group Details"
      onBack={handleBack}
      actions={[
        <Button
          variant="link"
          className="rounded-full"
          onPress={() => router.push(`/groups/${groupId}/edit`)}
        >
          <Icon as="edit" size={28} className="text-secondary-950" />
        </Button>
      ]}
    >
      <Fab
        placement="bottom right"
        className="px-6 mb-2"
        isHovered={false}
        isDisabled={false}
        isPressed={false}
        onPress={() => router.push(`/groups/${groupId}/add-expense`)}
      >
        <Icon as="post-add" className="text-background-0" />
        <FabLabel>Add Expense</FabLabel>
      </Fab>
      <LoadingWrapper
        isLoading={loading}
        text="Loading group details, please wait..."
      >
        <ScrollView className="flex-1" bounces={false}>
          <VStack className="px-4 pb-2 gap-y-6">
            <AppAvatar
              className="self-center"
              uri={groupDetails?.avatar || ""}
              name={groupDetails?.name || "Group Avatar"}
              size="xl"
            />

            <VStack className="items-center">
              <Text bold className="text-xl" numberOfLines={3}>
                {groupDetails?.name}
              </Text>
              <HStack className="gap-x-1">
                <Text className="text-secondary-950">
                  Joined {formatDate(groupDetails?.created_at || "")}
                </Text>
                <Text>&bull;</Text>
                <Text className="text-sm self-start py-1 px-2 bg-primary-100 text-primary-800 rounded-full">
                  {
                    categories.find(
                      (cat) => cat.value === groupDetails?.category
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
                  <Icon as="chevron-right" className="text-primary-400" />
                }
                size="md"
                onPress={() => router.push(`/groups/${groupId}/members`)}
              />
            </VStack>

            <HStack className="items-center">
              <Text bold className="text-xl flex-1">
                Expenses
              </Text>
              <Button variant="link" className="rounded-full">
                <Icon
                  size={28}
                  as="filter-list"
                  className="text-secondary-950"
                />
              </Button>
            </HStack>
          </VStack>
          <SwipeListView
            className="flex-1"
            bounces={false}
            scrollEnabled={false}
            useSectionList
            sections={formattedExpenseList}
            keyExtractor={(item) => item.id}
            renderItem={({ item }: { item: Expense }) => (
              <ExpenseItem
                key={item.id}
                expense={item}
                onOpen={() => router.push(`/groups/${groupId}/${item.id}`)}
              />
            )}
            renderHiddenItem={({ item }) => (
              <HStack className="flex-1 justify-end items-center flex-row px-4 gap-x-2 bg-background-50">
                {item.paid_by.id === userDetails?.id && (
                  <ConfirmIconButton
                    icon="delete"
                    iconClassName="text-background-0"
                    variant="solid"
                    action="negative"
                    className="rounded-full h-[40] w-[40] p-0"
                    confirmTitle="Delete Expense"
                    confirmDescription="Deleting this expense will remove splits and payments associated with it. Are you sure you want to proceed?"
                    onConfirm={() => handleDeleteExpense(item.id)}
                  />
                )}
              </HStack>
            )}
            rightOpenValue={-70}
            renderSectionHeader={({ section: { title } }) => (
              <Box className="bg-background-50 px-4 py-2 border-b border-secondary-100">
                <Text className="text-sm text-secondary-950">{title}</Text>
              </Box>
            )}
            ItemSeparatorComponent={() => (
              <Box className="mx-4">
                <Divider className="border-secondary-100" />
              </Box>
            )}
            stickySectionHeadersEnabled={true}
            ListEmptyComponent={() => (
              <VStack className="flex-1 justify-center items-center py-4">
                <Text className="text-secondary-950">
                  No expenses recorded yet.
                </Text>
              </VStack>
            )}
          />
          {/* <SectionList
            bounces={false}
            scrollEnabled={false}
            sections={formatExpenseList}
            keyExtractor={(item) => item.id}
            renderItem={({ item }: { item: Expense }) => (
              <ExpenseItem
                key={item.id}
                expense={item}
                onOpen={() => router.push(`/groups/${groupId}/${item.id}`)}
              />
            )}
            renderSectionHeader={({ section: { title } }) => (
              <Box className="bg-background-50 px-4 py-2 border-b border-secondary-100">
                <Text className="text-sm text-secondary-950">{title}</Text>
              </Box>
            )}
            ItemSeparatorComponent={() => (
              <Box className="mx-4">
                <Divider className="border-secondary-100" />
              </Box>
            )}
            stickySectionHeadersEnabled={true}
            ListEmptyComponent={() => (
              <VStack className="flex-1 justify-center items-center py-4">
                <Text className="text-secondary-950">
                  No expenses recorded yet.
                </Text>
              </VStack>
            )}
          /> */}
        </ScrollView>
      </LoadingWrapper>
    </InnerLayout>
  );
}

function ExpenseItem({
  expense,
  onOpen
}: {
  expense: Expense;
  onOpen: () => void;
}) {
  const { details: userDetails } = states.user.getState();
  const isCurrentUserPayer = expense.paid_by.id === userDetails?.id;

  return (
    <PressableListItem onPress={onOpen} className="p-4">
      <HStack className="justify-between items-center rounded-lg">
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
              {isCurrentUserPayer && " (You)"}
            </Text>
          </HStack>
        </VStack>
        <VStack>
          <Text className="text-lg text-right">
            {formatAmount(expense.amount)}
          </Text>
        </VStack>
        <Icon as="chevron-right" className="text-secondary-950" />
      </HStack>
    </PressableListItem>
  );
}
