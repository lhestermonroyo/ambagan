import AppAvatar from "@/components/AppAvatar";
import AppAvatarGroup from "@/components/AppAvatarGroup";
import ConfirmIconButton from "@/components/ConfirmIconButton";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import ListDivider from "@/components/ListDivider";
import LoadingWrapper from "@/components/LoadingWrapper";
import PressableListItem from "@/components/PressableListItem";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Fab, FabLabel } from "@/components/ui/fab";
import { HStack } from "@/components/ui/hstack";
import {
  Menu,
  MenuItem,
  MenuItemLabel,
  MenuSeparator
} from "@/components/ui/menu";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import GroupDetailsTab from "@/features/group/components/GroupDetailsTab";
import GroupExportTab from "@/features/group/components/GroupExportTab";
import GroupSettlements from "@/features/group/components/GroupSettlements";
import LeaveGroupSheet from "@/features/group/components/LeaveGroupSheet";
import useAppToast from "@/hooks/use-app-toast";
import InnerLayout from "@/layouts/InnerLayout";
import services from "@/services";
import states from "@/states";
import { cacheService } from "@/utils/cacheService";
import { ExpensePreview } from "@/types/expenses";
import { formatDate, getDateGroupTitle } from "@/utils/formatDate";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import { differenceInDays, format, parseISO } from "date-fns";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  Archive,
  ArchiveRestore,
  CirclePlus,
  Edit2,
  EllipsisVertical,
  LogOut
} from "lucide-react-native";
import { Fragment, useMemo, useState } from "react";
import { RefreshControl, useColorScheme } from "react-native";
import { SwipeListView } from "react-native-swipe-list-view";

const tabs = ["Settlements", "Expenses", "Group Info", "Export"] as const;

export default function GroupDetailsScreen() {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [settlementRefreshTrigger, setSettlementRefreshTrigger] = useState(0);
  const [archiving, setArchiving] = useState(false);
  const [showArchiveBanner, setShowArchiveBanner] = useState(true);
  const [leaveSheetOpen, setLeaveSheetOpen] = useState(false);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Settlements");

  const { details: groupDetails, expenseList, settlementList } = states.group();
  const { details: userDetails } = states.user();

  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
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

    const isPro = userDetails?.plan === "pro";

    try {
      const [groupDetailsResponse, expensesResponse, membersResponse] =
        await Promise.all([
          services.group.getGroupById(groupId),
          services.expense.getExpensesByGroupId(groupId),
          services.member.getMembersByGroupId(groupId)
        ]);

      if (!groupDetailsResponse || !expensesResponse || !membersResponse) {
        router.push("/groups");
        return;
      }

      if (isPro) {
        cacheService
          .saveGroupDetail(groupId, expensesResponse, membersResponse)
          .catch(() => {});
      }

      states.group.setState((prev) => ({
        ...prev,
        details: groupDetailsResponse,
        expenseList: expensesResponse,
        memberList: membersResponse
      }));
    } catch (error) {
      console.log("Error fetching group details:", error);
      if (isPro) {
        const cached = await cacheService.getGroupDetail(groupId);
        if (cached) {
          states.group.setState((prev) => ({
            ...prev,
            expenseList: cached.expenseList,
            memberList: cached.memberList
          }));
          setLoading(false);
          return;
        }
      }
      router.push("/groups");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!groupId) return;
    setRefreshing(true);
    setSettlementRefreshTrigger((prev) => prev + 1);
    await init(groupId, true);
    setRefreshing(false);
  };

  const handleUnarchiveGroup = async () => {
    setArchiving(true);
    try {
      await services.group.unarchiveGroup(groupId!);
      states.group.setState((prev) => ({
        ...prev,
        details: prev.details ? { ...prev.details, archived: false } : null
      }));
      toast({
        title: "Group restored",
        description: "Group has been moved back to your active groups.",
        type: "success"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to restore group. Please try again.",
        type: "error"
      });
    } finally {
      setArchiving(false);
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
      details: null,
      memberList: [],
      expenseList: [],
      settlementList: []
    }));
    router.push("/groups");
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

  const shouldSuggestArchive = useMemo(() => {
    if (!isAdmin || !groupDetails || groupDetails.archived || loading)
      return false;
    if (expenseList.length === 0) return false;

    const hasActiveSettlements = settlementList.some(
      (p) => p.status === "pending" || p.status === "requested"
    );
    if (hasActiveSettlements) return false;

    const dates = [
      expenseList[0]?.created_at,
      ...settlementList.map((p) => p.status_updated_at)
    ]
      .filter(Boolean)
      .map((d) => new Date(d));

    const lastActivity = new Date(Math.max(...dates.map((d) => d.getTime())));
    return differenceInDays(new Date(), lastActivity) >= 30;
  }, [isAdmin, groupDetails, loading, expenseList, settlementList]);

  const handleArchiveGroup = async () => {
    setArchiving(true);
    try {
      await services.group.archiveGroup(groupId!);
      states.group.setState((prev) => ({
        ...prev,
        list: prev.list.filter((g) => g.id !== groupId),
        details: null,
        memberList: [],
        expenseList: [],
        settlementList: []
      }));
      toast({
        title: "Group archived",
        description: "You can find it in the Archived tab.",
        type: "success"
      });
      router.push("/groups");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to archive group. Please try again.",
        type: "error"
      });
    } finally {
      setArchiving(false);
    }
  };

  return (
    <Fragment>
      <InnerLayout
        title="Group Details"
        onBack={handleBack}
        actions={
          isAdmin
            ? [
                <Menu
                  placement="left top"
                  closeOnSelect
                  selectionMode="single"
                  onSelectionChange={(selected) => {
                    const key = Array.from(selected)[0];
                    if (key === "edit") {
                      router.push(`/groups/${groupId}/edit`);
                    } else if (key === "archive") {
                      handleArchiveGroup();
                    } else if (key === "unarchive") {
                      handleUnarchiveGroup();
                    } else if (key === "leave") {
                      setLeaveSheetOpen(true);
                    }
                  }}
                  trigger={({ ...triggerProps }) => (
                    <Button
                      variant="link"
                      className="rounded-full"
                      {...triggerProps}
                    >
                      <EllipsisVertical
                        size={20}
                        color={getSecondaryHex(
                          "text-secondary-950",
                          colorScheme
                        )}
                      />
                    </Button>
                  )}
                >
                  {!groupDetails?.archived && (
                    <MenuItem
                      className="p-4 justify-between"
                      key="edit"
                      textValue="Edit"
                    >
                      <HStack className="gap-x-2">
                        <Edit2 size={20} />
                        <MenuItemLabel>Edit</MenuItemLabel>
                      </HStack>
                    </MenuItem>
                  )}
                  <MenuItem
                    className="p-4 justify-between"
                    key="leave"
                    textValue="Leave Group"
                  >
                    <HStack className="gap-x-2">
                      <LogOut size={20} />
                      <MenuItemLabel>Leave Group</MenuItemLabel>
                    </HStack>
                  </MenuItem>
                  <MenuSeparator key="separator" />
                  {groupDetails?.archived ? (
                    <MenuItem
                      className="p-4 justify-between"
                      key="unarchive"
                      textValue="Unarchive"
                    >
                      <HStack className="gap-x-2">
                        <ArchiveRestore size={20} />
                        <MenuItemLabel>Unarchive</MenuItemLabel>
                      </HStack>
                    </MenuItem>
                  ) : (
                    <MenuItem
                      className="p-4 justify-between"
                      key="archive"
                      textValue="Archive"
                    >
                      <HStack className="gap-x-2">
                        <Archive size={20} />
                        <MenuItemLabel>Archive</MenuItemLabel>
                      </HStack>
                    </MenuItem>
                  )}
                </Menu>
              ]
            : [
                <Button
                  variant="link"
                  className="rounded-full"
                  onPress={() => setLeaveSheetOpen(true)}
                >
                  <LogOut
                    size={20}
                    color={getSecondaryHex("text-secondary-950", colorScheme)}
                  />
                </Button>
              ]
        }
      >
        {(tab === "Expenses" || tab === "Settlements") &&
          !groupDetails?.archived && (
            <Fab
              placement="bottom right"
              className="px-6"
              isHovered={false}
              isDisabled={false}
              isPressed={false}
              onPress={() => router.push(`/groups/${groupId}/new-expense`)}
            >
              <CirclePlus
                size={20}
                color={getSecondaryHex("text-secondary-0", colorScheme)}
              />
              <FabLabel className="text-lg font-medium">New Expense</FabLabel>
            </Fab>
          )}
        <LoadingWrapper isLoading={loading} text="Loading group details...">
          <ScrollView
            className="flex-1"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
              />
            }
          >
            <VStack className="pb-4 gap-y-8">
              <HStack className="px-4 gap-x-4 items-center">
                <VStack>
                  <AppAvatar
                    className="self-center"
                    uri={groupDetails?.avatar || ""}
                    name={groupDetails?.name || "Group Avatar"}
                    size="lg"
                  />
                </VStack>
                <VStack>
                  <Text bold className="text-2xl" numberOfLines={3}>
                    {groupDetails?.name}
                  </Text>
                  <Text className="text-secondary-950">
                    {formatDate(groupDetails?.created_at || "")} &bull;{" "}
                    {expenseList.length} expense{expenseList.length !== 1 ? "s" : ""}
                  </Text>
                </VStack>
              </HStack>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <HStack className="gap-x-2 px-4">
                  {tabs.map((type) => (
                    <FormButton
                      size="sm"
                      key={type}
                      variant={type === tab ? "solid" : "outline"}
                      text={type}
                      onPress={() => setTab(type)}
                    />
                  ))}
                </HStack>
              </ScrollView>
            </VStack>

            {groupDetails?.archived ? (
              <HStack className="mx-4 p-4 rounded-xl bg-secondary-100 dark:bg-secondary-900 border border-secondary-200 dark:border-secondary-800 gap-x-3 items-start">
                <Archive
                  size={18}
                  color={getSecondaryHex("text-secondary-950", colorScheme)}
                  style={{ marginTop: 2 }}
                />
                <VStack className="flex-1 gap-y-3">
                  <VStack className="gap-y-0.5">
                    <Text className="text-lg font-semibold">
                      This group is archived
                    </Text>
                    <Text className="text-secondary-950">
                      New expenses are disabled. Unarchive to continue adding
                      expenses.
                    </Text>
                  </VStack>
                  {isAdmin && (
                    <FormButton
                      text="Unarchive"
                      loading={archiving}
                      onPress={handleUnarchiveGroup}
                    />
                  )}
                </VStack>
              </HStack>
            ) : (
              shouldSuggestArchive &&
              showArchiveBanner && (
                <HStack className="mx-4 p-4 rounded-xl bg-primary-50 dark:bg-primary-950 border border-primary-200 dark:border-primary-800 gap-x-3 items-start">
                  <Archive
                    size={18}
                    color={getPrimaryHex("text-primary-500", colorScheme)}
                    style={{ marginTop: 2 }}
                  />
                  <VStack className="flex-1 gap-y-3">
                    <VStack className="gap-y-0.5">
                      <Text className="text-lg font-semibold">
                        Ready to archive?
                      </Text>
                      <Text className="text-secondary-950">
                        All settled up with no activity for 30+ days.
                      </Text>
                    </VStack>
                    <HStack className="gap-x-2">
                      <FormButton
                        text="Archive"
                        loading={archiving}
                        onPress={handleArchiveGroup}
                      />
                      <FormButton
                        variant="outline"
                        text="Dismiss"
                        disabled={archiving}
                        onPress={() => setShowArchiveBanner(false)}
                      />
                    </HStack>
                  </VStack>
                </HStack>
              )
            )}

            <Box className={tab !== "Settlements" ? "hidden" : ""}>
              <GroupSettlements refreshTrigger={settlementRefreshTrigger} />
            </Box>
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
                renderHiddenItem={({ item }, rowMap) =>
                  item.payer_list.some(
                    (item) => item.payer.id === userDetails?.id
                  ) && (
                    <HStack className="flex-1 justify-end items-center flex-row px-4 gap-x-2 bg-background-50">
                      <ConfirmIconButton
                        icon="delete"
                        iconClassName="text-background-0"
                        variant="solid"
                        action="negative"
                        className="rounded-full h-[40] w-[40] p-0"
                        confirmTitle="Delete Expense"
                        confirmDescription="Deleting this expense will remove splits and payments associated with it. Are you sure you want to proceed?"
                        isDelete
                        onConfirm={() => {
                          rowMap[item.id]?.closeRow();
                          handleDeleteExpense(item.id);
                        }}
                      />
                    </HStack>
                  )
                }
                rightOpenValue={-70}
                renderSectionHeader={({ section: { title } }) => (
                  <Box className="bg-background-50 px-4 py-2 border-b border-secondary-100">
                    <Text className="text-sm text-secondary-950">{title}</Text>
                  </Box>
                )}
                ItemSeparatorComponent={ListDivider}
                stickySectionHeadersEnabled={true}
                ListEmptyComponent={() => (
                  <VStack className="flex-1 justify-center items-center py-4">
                    <Text className="text-secondary-950">
                      No expenses recorded yet.
                    </Text>
                  </VStack>
                )}
                ListFooterComponent={() => <Box className="h-16" />}
              />
            )}
            {tab === "Group Info" && <GroupDetailsTab />}
            {tab === "Export" && groupId && userDetails && (
              <GroupExportTab
                groupId={groupId}
                groupName={groupDetails?.name ?? ""}
                userId={userDetails.id}
                isPro={userDetails.plan === "pro"}
              />
            )}
          </ScrollView>
        </LoadingWrapper>
      </InnerLayout>
      <LeaveGroupSheet
        isOpen={leaveSheetOpen}
        onClose={() => setLeaveSheetOpen(false)}
        onLeave={(groupDeleted) => {
          setLeaveSheetOpen(false);
          states.group.setState((prev) => ({
            ...prev,
            list: groupDeleted
              ? prev.list.filter((g) => g.id !== groupId)
              : prev.list,
            details: null,
            memberList: [],
            expenseList: [],
            settlementList: []
          }));
          router.push("/groups");
        }}
      />
    </Fragment>
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
    const userPayer = expense.payer_list.find(
      (payer) => payer.payer.id === userDetails?.id
    );

    if (userPayer) {
      return [
        userPayer,
        ...expense.payer_list.filter((p) => p !== userPayer)
      ].map((item) => ({
        id: item.payer.id,
        name: `${item.payer.first_name} ${item.payer.last_name?.[0] || ""}`,
        uri: item.payer.avatar || undefined
      }));
    }
    return expense.payer_list.map((item) => ({
      id: item.payer.id,
      name: `${item.payer.first_name} ${item.payer.last_name?.[0] || ""}`,
      uri: item.payer.avatar || undefined
    }));
  }, [expense.payer_list, userDetails?.id]);

  return (
    <PressableListItem onPress={onOpen} className="p-4">
      <HStack className="justify-between items-center rounded-lg">
        <VStack className="flex-1">
          <Text className="text-lg" numberOfLines={2} ellipsizeMode="tail">
            {expense.description}
          </Text>
          <HStack className="gap-x-1 items-center">
            <Text className="text-secondary-950">Paid by</Text>
            <AppAvatarGroup items={formattedPayers} size="xs" />
          </HStack>
        </VStack>
        <VStack className="items-end gap-y-1">
          <Text className="text-lg text-right">
            {formatAmount(expense.amount, expense.currency)}
          </Text>
        </VStack>
        <Icon as="chevron-right" className="text-secondary-950" />
      </HStack>
    </PressableListItem>
  );
}
