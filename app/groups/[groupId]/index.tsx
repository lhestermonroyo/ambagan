import AppAvatar from "@/components/AppAvatar";
import AppAvatarGroup from "@/components/AppAvatarGroup";
import ConfirmIconButton from "@/components/ConfirmIconButton";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import ListDivider from "@/components/ListDivider";
import LoadingWrapper from "@/components/LoadingWrapper";
import PressableListItem from "@/components/PressableListItem";
import { ExpenseListSkeleton } from "@/components/SkeletonLoader";
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
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import QuickAddExpenseSheet from "@/features/expense/components/QuickAddExpenseSheet";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import GroupDetailsTab from "@/features/group/components/GroupDetailsTab";
import GroupSettlements from "@/features/group/components/GroupSettlements";
import GroupStatsTab from "@/features/group/components/GroupStatsTab";
import LeaveGroupSheet from "@/features/group/components/LeaveGroupSheet";
import useAppToast from "@/hooks/use-app-toast";
import InnerLayout from "@/layouts/InnerLayout";
import services from "@/services";
import states from "@/states";
import { ExpensePreview } from "@/types/expenses";
import { cacheService } from "@/utils/cacheService";
import { groupByCurrency } from "@/utils/currency";
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
  ListPlus,
  LogOut,
  X,
  Zap
} from "lucide-react-native";
import { Fragment, useMemo, useRef, useState } from "react";
import { Animated, RefreshControl, useColorScheme } from "react-native";
import { SwipeListView } from "react-native-swipe-list-view";

const tabs = ["Settlements", "Expenses", "Stats", "Group Info"] as const;

export default function GroupDetailsScreen() {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [settlementRefreshTrigger, setSettlementRefreshTrigger] = useState(0);
  const [archiving, setArchiving] = useState(false);
  const [showArchiveBanner, setShowArchiveBanner] = useState(true);
  const [leaveSheetOpen, setLeaveSheetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Settlements");

  const { details: groupDetails, expenseList, settlementList } = states.group();
  const { details: userDetails, defaultCurrency } = states.user();

  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";

  const scrollY = useRef(new Animated.Value(0)).current;

  const activeSettlements = useMemo(
    () => settlementList.filter((p) => p.status !== "settled"),
    [settlementList]
  );

  const compactToCollect = useMemo(
    () =>
      groupByCurrency(
        activeSettlements.filter((p) => p.payer.id === userDetails?.id)
      ),
    [activeSettlements, userDetails?.id]
  );

  const compactToPay = useMemo(
    () =>
      groupByCurrency(
        activeSettlements.filter((p) => p.member.id === userDetails?.id)
      ),
    [activeSettlements, userDetails?.id]
  );

  const compactNetBalance = useMemo(() => {
    const allCurrencies = new Set([
      ...compactToCollect.map((i) => i.currency),
      ...compactToPay.map((i) => i.currency)
    ]);
    return Array.from(allCurrencies).map((currency) => {
      const receive =
        compactToCollect.find((i) => i.currency === currency)?.amount ?? 0;
      const pay =
        compactToPay.find((i) => i.currency === currency)?.amount ?? 0;
      return { currency, amount: receive - pay };
    });
  }, [compactToCollect, compactToPay]);

  const primaryCompactNet = useMemo(() => {
    const sorted = [...compactNetBalance].sort((a, b) =>
      a.currency === defaultCurrency
        ? -1
        : b.currency === defaultCurrency
          ? 1
          : 0
    );
    return sorted[0] ?? { currency: defaultCurrency, amount: 0 };
  }, [compactNetBalance, defaultCurrency]);

  const primaryCompactCollect = useMemo(() => {
    const sorted = [...compactToCollect].sort((a, b) =>
      a.currency === defaultCurrency
        ? -1
        : b.currency === defaultCurrency
          ? 1
          : 0
    );
    return sorted[0] ?? { currency: defaultCurrency, amount: 0 };
  }, [compactToCollect, defaultCurrency]);

  const primaryCompactPay = useMemo(() => {
    const sorted = [...compactToPay].sort((a, b) =>
      a.currency === defaultCurrency
        ? -1
        : b.currency === defaultCurrency
          ? 1
          : 0
    );
    return sorted[0] ?? { currency: defaultCurrency, amount: 0 };
  }, [compactToPay, defaultCurrency]);

  const COMPACT_THRESHOLD = 280;
  const compactOpacity = scrollY.interpolate({
    inputRange: [COMPACT_THRESHOLD - 60, COMPACT_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: "clamp"
  });
  const compactTranslateY = scrollY.interpolate({
    inputRange: [COMPACT_THRESHOLD - 60, COMPACT_THRESHOLD],
    outputRange: [-16, 0],
    extrapolate: "clamp"
  });
  const compactHeight = scrollY.interpolate({
    inputRange: [COMPACT_THRESHOLD - 60, COMPACT_THRESHOLD],
    outputRange: [0, 60],
    extrapolate: "clamp"
  });
  const params = useLocalSearchParams();
  const groupId = params.groupId as string | undefined;

  const toast = useAppToast();

  useFocusEffect(
    useMemo(
      () => () => {
        if (!groupId) {
          router.replace("/groups");
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
      const [groupDetailsResponse, expensesResponse, membersResponse] =
        await Promise.all([
          services.group.getGroupById(groupId),
          services.expense.getExpensesByGroupId(groupId),
          services.member.getMembersByGroupId(groupId)
        ]);

      if (!groupDetailsResponse || !expensesResponse || !membersResponse) {
        router.replace("/groups");
        return;
      }

      states.group.setState((prev) => ({
        ...prev,
        details: groupDetailsResponse,
        expenseList: expensesResponse,
        memberList: membersResponse
      }));

      // Cache the detail so it stays viewable offline.
      cacheService
        .saveGroupDetail(groupId, expensesResponse, membersResponse)
        .catch(() => {});
    } catch (error) {
      // Offline / fetch failure — hydrate from cache rather than bailing out.
      const cached = await cacheService.getGroupDetail(groupId).catch(() => null);
      const cachedGroup = states.group
        .getState()
        .list.find((g) => g.id === groupId);

      if (cached && cachedGroup) {
        states.group.setState((prev) => ({
          ...prev,
          details: cachedGroup,
          expenseList: cached.expenseList,
          memberList: cached.memberList
        }));
      } else {
        console.log("Error fetching group details:", error);
        router.replace("/groups");
      }
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
      router.replace("/groups");
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
                  isOpen={menuOpen}
                  onOpen={() => setMenuOpen(true)}
                  onClose={() => setMenuOpen(false)}
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
                      onPress={() => {
                        setMenuOpen(false);
                        setTimeout(
                          () => router.push(`/groups/${groupId}/edit`),
                          150
                        );
                      }}
                    >
                      <HStack className="gap-x-2">
                        <Edit2
                          size={20}
                          color={getPrimaryHex("text-primary-500", colorScheme)}
                        />
                        <MenuItemLabel>Edit</MenuItemLabel>
                      </HStack>
                    </MenuItem>
                  )}
                  <MenuItem
                    className="p-4 justify-between"
                    key="leave"
                    textValue="Leave Group"
                    onPress={() => {
                      setMenuOpen(false);
                      setTimeout(() => setLeaveSheetOpen(true), 150);
                    }}
                  >
                    <HStack className="gap-x-2">
                      <LogOut
                        size={20}
                        color={getPrimaryHex("text-primary-500", colorScheme)}
                      />
                      <MenuItemLabel>Leave Group</MenuItemLabel>
                    </HStack>
                  </MenuItem>
                  <MenuSeparator key="separator" />
                  {groupDetails?.archived ? (
                    <MenuItem
                      className="p-4 justify-between"
                      key="unarchive"
                      textValue="Unarchive"
                      onPress={() => {
                        setMenuOpen(false);
                        setTimeout(() => handleUnarchiveGroup(), 150);
                      }}
                    >
                      <HStack className="gap-x-2">
                        <ArchiveRestore
                          size={20}
                          color={getPrimaryHex("text-primary-500", colorScheme)}
                        />
                        <MenuItemLabel>Unarchive</MenuItemLabel>
                      </HStack>
                    </MenuItem>
                  ) : (
                    <MenuItem
                      className="p-4 justify-between"
                      key="archive"
                      textValue="Archive"
                      onPress={() => {
                        setMenuOpen(false);
                        setTimeout(() => handleArchiveGroup(), 150);
                      }}
                    >
                      <HStack className="gap-x-2">
                        <Archive
                          size={20}
                          color={getPrimaryHex("text-primary-500", colorScheme)}
                        />
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
            <>
              {fabOpen && (
                <Pressable
                  className="absolute inset-0 z-40"
                  onPress={() => setFabOpen(false)}
                />
              )}
              {fabOpen && (
                <VStack className="absolute bottom-20 right-4 z-50 gap-2 items-end">
                  <Pressable
                    className="flex-row items-center gap-x-2 bg-white dark:bg-[#1F1F1F] px-4 py-2.5 rounded-full shadow-sm"
                    onPress={() => {
                      setFabOpen(false);
                      setQuickAddOpen(true);
                    }}
                  >
                    <Zap
                      size={18}
                      color={getPrimaryHex("text-primary-400", colorScheme)}
                    />
                    <Text className="font-semibold">Quick Add</Text>
                  </Pressable>
                  <Pressable
                    className="flex-row items-center gap-x-2 bg-white dark:bg-[#1F1F1F] px-4 py-2.5 rounded-full shadow-sm"
                    onPress={() => {
                      setFabOpen(false);
                      router.push(`/groups/${groupId}/new-expense`);
                    }}
                  >
                    <ListPlus
                      size={18}
                      color={getSecondaryHex("text-secondary-950", colorScheme)}
                    />
                    <Text className="font-semibold">Custom</Text>
                  </Pressable>
                </VStack>
              )}
              <Fab
                placement="bottom right"
                className="px-6"
                isHovered={false}
                isDisabled={false}
                isPressed={false}
                onPress={() => setFabOpen((prev) => !prev)}
              >
                {fabOpen ? (
                  <X
                    size={18}
                    color={getSecondaryHex("text-secondary-0", colorScheme)}
                  />
                ) : (
                  <CirclePlus
                    size={18}
                    color={getSecondaryHex("text-secondary-0", colorScheme)}
                  />
                )}
                <FabLabel className="text-lg font-medium">
                  {fabOpen ? "Close" : "New Expense"}
                </FabLabel>
              </Fab>
            </>
          )}
        {/* Compact sticky stats — Settlements tab only */}
        {tab === "Settlements" && (
          <Animated.View
            style={{
              height: compactHeight,
              opacity: compactOpacity,
              overflow: "hidden",
              transform: [{ translateY: compactTranslateY }],
              borderBottomWidth: 1,
              borderBottomColor: "rgba(0,0,0,0.06)"
            }}
          >
            <HStack className="px-6 pt-2 gap-x-4 items-center justify-center bg-background-0">
              <VStack className="items-center flex-1">
                <Text className="text-secondary-950 text-sm uppercase tracking-widest">
                  Net
                </Text>
                <Text
                  bold
                  className={`text-lg ${
                    primaryCompactNet.amount < 0 ? "text-error-400" : ""
                  }`}
                >
                  {formatAmount(
                    primaryCompactNet.amount,
                    primaryCompactNet.currency
                  )}
                </Text>
              </VStack>
              <Text className="text-secondary-200">|</Text>
              <VStack className="items-center flex-1">
                <Text className="text-secondary-950 text-sm uppercase tracking-widest">
                  Collect
                </Text>
                <Text bold className="text-lg">
                  {formatAmount(
                    primaryCompactCollect.amount,
                    primaryCompactCollect.currency
                  )}
                </Text>
              </VStack>
              <Text className="text-secondary-200">|</Text>
              <VStack className="items-center flex-1">
                <Text className="text-secondary-950 text-sm uppercase tracking-widest">
                  Pay
                </Text>
                <Text bold className="text-lg text-error-400">
                  {formatAmount(
                    primaryCompactPay.amount,
                    primaryCompactPay.currency
                  )}
                </Text>
              </VStack>
            </HStack>
          </Animated.View>
        )}

        <LoadingWrapper isLoading={loading} skeleton={<ExpenseListSkeleton />}>
          <ScrollView
            className="flex-1"
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: false }
            )}
            scrollEventThrottle={16}
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
                    {expenseList.length} expense
                    {expenseList.length !== 1 ? "s" : ""}
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
              <HStack className="mx-4 mb-4 p-4 rounded-xl bg-secondary-100 dark:bg-secondary-900 border border-secondary-200 dark:border-secondary-800 gap-x-2 items-start">
                <Archive
                  color={getPrimaryHex("text-primary-500", colorScheme)}
                />
                <VStack className="flex-1 gap-y-4">
                  <VStack className="gap-y-1">
                    <Text className="text-lg font-semibold">
                      This group is archived
                    </Text>
                    <Text>
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
                <HStack className="mx-4 mb-4 p-4 rounded-xl bg-primary-50 dark:bg-primary-950 border border-primary-200 dark:border-primary-800 gap-x-2 items-start">
                  <Archive
                    color={getPrimaryHex("text-primary-500", colorScheme)}
                  />
                  <VStack className="flex-1 gap-y-3">
                    <VStack className="gap-y-0.5">
                      <Text className="text-lg font-semibold">
                        Ready to archive?
                      </Text>
                      <Text className="text-sm text-secondary-950">
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
                    <Text className="text-sm text-secondary-950">
                      No expenses recorded yet.
                    </Text>
                  </VStack>
                )}
                ListFooterComponent={() => <Box className="h-16" />}
              />
            )}
            {tab === "Group Info" && <GroupDetailsTab />}
            {tab === "Stats" && groupId && userDetails && (
              <GroupStatsTab
                groupId={groupId}
                groupName={groupDetails?.name ?? ""}
                userId={userDetails.id}
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
          router.replace("/groups");
        }}
      />
      <QuickAddExpenseSheet
        isOpen={quickAddOpen}
        group={groupDetails}
        onClose={() => setQuickAddOpen(false)}
        onSuccess={() => {
          if (groupId) {
            init(groupId, true);
            setSettlementRefreshTrigger((prev) => prev + 1);
          }
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
        name: item.payer.first_name,
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
          {expense.pending && (
            <Box className="self-start bg-warning-50 dark:bg-warning-900 rounded-full px-2 py-0.5 my-0.5">
              <Text className="text-warning-600 text-2xs font-semibold uppercase">
                Syncing…
              </Text>
            </Box>
          )}
          <HStack className="gap-x-1 items-center">
            <Text className="text-sm text-secondary-950">Paid by</Text>
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
