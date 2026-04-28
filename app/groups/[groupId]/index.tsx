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
import { Menu, MenuItem, MenuItemLabel } from "@/components/ui/menu";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import useAppToast from "@/hooks/use-app-toast";
import InnerLayout from "@/layouts/InnerLayout";
import services from "@/services";
import states from "@/states";
import { ExpensePreview } from "@/types/expenses";
import { formatDate, getDateGroupTitle } from "@/utils/formatDate";
import { getSecondaryHex } from "@/utils/getColorHex";
import { format, parseISO } from "date-fns";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  CirclePlus,
  Edit2,
  EllipsisVertical,
  Info,
  Trash2
} from "lucide-react-native";
import { Fragment, useMemo, useState } from "react";
import { SwipeListView } from "react-native-swipe-list-view";

const tabs = ["Expenses", "Totals", "Group Details"] as const;

export default function GroupDetailsScreen() {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Expenses");

  const { details: groupDetails, expenseList } = states.group();
  const { details: userDetails } = states.user();

  const router = useRouter();
  const params = useLocalSearchParams();
  const groupId = params.groupId as string | undefined;

  const toast = useAppToast();

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
        expensesResponse
        // statsResponse,
        // membersResponse,
        // expensesResponse
      ] = await Promise.all([
        services.group.getGroupById(groupId),
        services.expense.getExpensesByGroupId(groupId)
        // services.group.getStatsByGroupId(groupId),
        // services.member.getMembersByGroupId(groupId),
        // services.expense.getExpensesByGroup(groupId)
      ]);

      if (!groupDetailsResponse || !expensesResponse) {
        router.push("/groups");
        return;
      }

      console.log(JSON.stringify(expensesResponse, null, 2));

      states.group.setState((prev) => ({
        ...prev,
        details: groupDetailsResponse,
        expenseList: expensesResponse
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
        toast({
          title: "Success",
          description: "Group deleted successfully",
          type: "success"
        });
        router.push("/groups");
      }
    } catch (error) {
      console.log("Error deleting group:", error);
      toast({
        title: "Error",
        description: "Failed to delete group. Please try again.",
        type: "error"
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      const deleteResponse = await services.expense.deleteExpense(expenseId);

      if (deleteResponse.success) {
        toast({
          title: "Success",
          description: "Expense deleted successfully",
          type: "success"
        });
        init(groupId!, true);
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
    states.group.setState((prev) => ({
      ...prev,
      details: null
    }));
    router.back();
  };

  const formattedExpenseList = useMemo(() => {
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
  }, [expenseList]);

  const isAdmin = groupDetails?.admin.id === userDetails?.id;

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
          <Info size={20} color={getSecondaryHex("text-secondary-950")} />
        </Button>,
        <Menu
          placement="left top"
          closeOnSelect
          selectionMode="single"
          onSelectionChange={(selected) => {
            const key = Array.from(selected)[0];

            if (key === "edit") {
              router.push(`/groups/${groupId}/edit`);
            } else if (key === "delete") {
              handleDeleteGroup();
            }
          }}
          trigger={({ ...triggerProps }) => {
            return (
              <Button variant="link" className="rounded-full" {...triggerProps}>
                <EllipsisVertical
                  size={20}
                  color={getSecondaryHex("text-secondary-950")}
                />
              </Button>
            );
          }}
        >
          <MenuItem className="p-4 justify-between" key="edit" textValue="Edit">
            <HStack className="gap-x-2">
              <Edit2 size={20} />
              <MenuItemLabel>Edit</MenuItemLabel>
            </HStack>
          </MenuItem>
          <MenuItem
            className="p-4 justify-between"
            key="delete"
            textValue="Delete"
          >
            <HStack className="gap-x-2">
              <Trash2 size={20} />
              <MenuItemLabel>Delete</MenuItemLabel>
            </HStack>
          </MenuItem>
        </Menu>
        // <ConfirmIconButton
        //   icon="delete"
        //   iconSize={28}
        //   iconClassName="text-secondary-950"
        //   variant="link"
        //   className="rounded-full"
        //   confirmTitle="Delete Group"
        //   confirmDescription="Deleting this group will remove all associated expenses and payments. Are you sure you want to proceed?"
        //   isDelete
        //   isLoading={deleting}
        //   onConfirm={handleDeleteGroup}
        // />
      ]}
    >
      {tab === "Expenses" && (
        <Fab
          placement="bottom right"
          className="px-6"
          isHovered={false}
          isDisabled={false}
          isPressed={false}
          onPress={() => router.push(`/groups/${groupId}/new-expense`)}
        >
          <CirclePlus size={20} color={getSecondaryHex("text-secondary-0")} />
          <FabLabel className="text-lg font-medium">New Expense</FabLabel>
        </Fab>
      )}
      <LoadingWrapper
        isLoading={loading}
        text="Loading group details, please wait..."
      >
        <ScrollView className="flex-1" bounces={false}>
          <VStack className="pb-4 gap-y-6">
            <HStack className="px-4 gap-x-4 items-center">
              <VStack>
                <AppAvatar
                  className="self-center"
                  uri={groupDetails?.avatar || ""}
                  name={groupDetails?.name || "Group Avatar"}
                  size="xl"
                />
              </VStack>
              <VStack>
                <Text bold className="text-2xl" numberOfLines={3}>
                  {groupDetails?.name}
                </Text>
                <Text className="text-secondary-950">
                  {isAdmin ? "Created" : "Joined"}{" "}
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
              renderItem={({ item }: { item: ExpensePreview }) => (
                <ExpenseItem
                  key={item.id}
                  expense={item}
                  onOpen={() => router.push(`/groups/${groupId}/${item.id}`)}
                />
              )}
              renderHiddenItem={({ item }) => (
                <HStack className="flex-1 justify-end items-center flex-row px-4 gap-x-2 bg-background-50">
                  {item.payer_list.some(
                    (item) => item.payer.id === userDetails?.id
                  ) && (
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
          {/* {tab === "Totals" && <GroupTotals details={groupDetails} />}
          {tab === "Group Details" && (
            <GroupDetailsTab details={groupDetails} />
          )} */}
        </ScrollView>
      </LoadingWrapper>
    </InnerLayout>
  );
}

function ExpenseItem({
  expense,
  onOpen
}: {
  expense: ExpensePreview;
  onOpen: () => void;
}) {
  const { details: userDetails } = states.user();

  const formattedPayers = useMemo(() => {
    if (!expense.payer_list || expense.payer_list.length === 0) return null;

    // Find if current user is in payer_list
    const userIndex = expense.payer_list.findIndex(
      (item) => item.payer.id === userDetails?.id
    );
    // If user is in the list, make them payerOne, else use the first payer
    const payerOneIndex = userIndex !== -1 ? userIndex : 0;
    const payerOne = expense.payer_list[payerOneIndex].payer;
    // Remaining payers (excluding payerOne)
    const remainingPayers = expense.payer_list
      .filter((_, idx) => idx !== payerOneIndex)
      .map((item) => {
        return {
          id: item.payer.id,
          name: `${item.payer.first_name} ${item.payer.last_name}`,
          uri: item.payer.avatar || undefined
        };
      });

    return {
      payerOne,
      remainingPayers
    };
  }, [expense.payer_list, userDetails?.id]);

  return (
    <PressableListItem onPress={onOpen} className="p-4">
      <HStack className="justify-between items-center rounded-lg">
        <VStack className="flex-1">
          <Text className="text-lg" numberOfLines={2} ellipsizeMode="tail">
            {expense.description}
          </Text>
          {formattedPayers && (
            <HStack className="gap-x-1 items-center">
              <Text className="text-secondary-950">Paid by</Text>
              <AppAvatar
                name={`${formattedPayers.payerOne.first_name} ${formattedPayers.payerOne.last_name}`}
                uri={formattedPayers.payerOne.avatar || ""}
                size="xs"
              />
              <Text>
                {formattedPayers.payerOne.first_name}{" "}
                {userDetails?.id === formattedPayers.payerOne.id ? "(You)" : ""}
              </Text>
              {formattedPayers.remainingPayers.length > 0 && (
                <Fragment>
                  <Text className="text-secondary-950">&</Text>
                  <AppAvatarGroup
                    items={formattedPayers.remainingPayers}
                    size="xs"
                  />
                </Fragment>
              )}
            </HStack>
          )}
        </VStack>
        <VStack>
          <Text className="text text-right">
            {formatAmount(expense.amount)}
          </Text>
        </VStack>
        <Icon as="chevron-right" className="text-secondary-950" />
      </HStack>
    </PressableListItem>
  );
}
