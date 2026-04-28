import AppAvatar from "@/components/AppAvatar";
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
import GroupDetailsTab from "@/features/group/components/GroupDetailsTab";
import GroupTotals from "@/features/group/components/GroupTotals";
import useAppToast from "@/hooks/use-app-toast";
import InnerLayout from "@/layouts/InnerLayout";
import services from "@/services";
import states from "@/states";
import { Expense } from "@/types/expenses";
import { formatDate, getDateGroupTitle } from "@/utils/formatDate";
import { format, parseISO } from "date-fns";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { SwipeListView } from "react-native-swipe-list-view";

const tabs = ["Expenses", "Totals", "Group Details"] as const;

export default function GroupDetailsScreen() {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Expenses");

  const { details: groupDetails } = states.group();
  const { details: userDetails } = states.user();

  const router = useRouter();
  const params = useLocalSearchParams();
  const groupId = params.groupId as string | undefined;

  const showToast = useAppToast();

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
      [groupId, groupDetails?.id]
    )
  );

  const init = async (groupId: string, initialized = false) => {
    if (!initialized) {
      setLoading(true);
    }

    try {
      const [
        groupDetailsResponse,
        statsResponse,
        membersResponse,
        expensesResponse
      ] = await Promise.all([
        services.group.getGroupById(groupId),
        services.group.getStatsByGroupId(groupId),
        services.member.getMembersByGroupId(groupId),
        services.expense.getExpensesByGroup(groupId)
      ]);

      if (!groupDetailsResponse || !membersResponse || !expensesResponse) {
        router.push("/groups");
        return;
      }

      console.log(statsResponse);

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

  const handleDeleteGroup = async () => {
    setDeleting(true);
    try {
      const deleteResponse = await services.group.deleteGroup(groupId!);

      if (deleteResponse.success) {
        showToast("Success", "Group deleted successfully", "success");
        router.push("/groups");
      }
    } catch (error) {
      console.log("Error deleting group:", error);
      showToast("Error", "Failed to delete group. Please try again.", "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      const deleteResponse = await services.expense.deleteExpense(expenseId);

      if (deleteResponse.success) {
        showToast("Success", "Expense deleted successfully", "success");
        init(groupId!, true);
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

  const handleBack = () => {
    states.group.setState((prev) => ({
      ...prev,
      details: null
    }));
    router.push("/groups");
  };

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

  const isCreator = groupDetails?.creator.id === userDetails?.id;
  const isYou = userDetails?.id === groupDetails?.creator.id;

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
        </Button>,
        <ConfirmIconButton
          icon="delete"
          iconSize={28}
          iconClassName="text-secondary-950"
          variant="link"
          className="rounded-full"
          confirmTitle="Delete Group"
          confirmDescription="Deleting this group will remove all associated expenses and payments. Are you sure you want to proceed?"
          isDelete
          isLoading={deleting}
          onConfirm={handleDeleteGroup}
        />
      ]}
    >
      {tab === "Expenses" && (
        <Fab
          placement="bottom right"
          className="px-6 mb-2"
          isHovered={false}
          isDisabled={false}
          isPressed={false}
          onPress={() => router.push(`/groups/${groupId}/add-expense`)}
        >
          <Icon as="post-add" className="text-background-0" />
          <FabLabel className="text-lg font-medium">Add Expense</FabLabel>
        </Fab>
      )}
      <LoadingWrapper
        isLoading={loading}
        text="Loading group details, please wait..."
      >
        <ScrollView className="flex-1" bounces={false}>
          <VStack className="pb-4 gap-y-6">
            <HStack className="px-4 gap-x-4 items-center">
              <VStack className="w-[20vw]">
                <AppAvatar
                  className="self-center"
                  uri={groupDetails?.avatar || ""}
                  name={groupDetails?.name || "Group Avatar"}
                  size="lg"
                />
              </VStack>
              <VStack>
                <Text bold className="text-xl" numberOfLines={3}>
                  {groupDetails?.name}
                </Text>
                <Text className="text-secondary-950">
                  {isCreator ? "Created" : "Joined"}{" "}
                  {formatDate(groupDetails?.created_at || "")}
                </Text>
              </VStack>
            </HStack>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <HStack className="gap-x-2 px-4">
                {tabs.map((type) => (
                  <FormButton
                    size="md"
                    key={type}
                    variant={type === tab ? "solid" : "outline"}
                    className="flex-1 h-10"
                    text={type}
                    onPress={() => setTab(type)}
                  />
                ))}
              </HStack>
            </ScrollView>
          </VStack>
          {tab === "Expenses" && (
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
          )}
          {tab === "Totals" && <GroupTotals details={groupDetails} />}
          {tab === "Group Details" && (
            <GroupDetailsTab details={groupDetails} />
          )}
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
  const { details: userDetails } = states.user();
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
