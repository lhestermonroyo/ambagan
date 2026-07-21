import AppAvatar from "@/components/AppAvatar";
import AppAvatarGroup from "@/components/AppAvatarGroup";
import ConfirmIconButton from "@/components/ConfirmIconButton";
import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import ListDivider from "@/components/ListDivider";
import LoadingWrapper from "@/components/LoadingWrapper";
import PressableListItem from "@/components/PressableListItem";
import { ExpenseListSkeleton } from "@/components/SkeletonLoader";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Fab, FabLabel } from "@/components/ui/fab";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import DeleteGroupSheet from "@/features/group/components/DeleteGroupSheet";
import GroupDetailsTab from "@/features/group/components/GroupDetailsTab";
import GroupSettlements from "@/features/group/components/GroupSettlements";
import GroupStatsTab from "@/features/group/components/GroupStatsTab";
import LeaveGroupSheet from "@/features/group/components/LeaveGroupSheet";
import useAppToast from "@/hooks/use-app-toast";
import { useEnsureOnline } from "@/hooks/useEnsureOnline";
import InnerLayout from "@/layouts/InnerLayout";
import services from "@/services";
import states from "@/states";
import { ExpensePreview } from "@/types/expenses";
import { EmptyType } from "@/types/general";
import { cacheService } from "@/utils/cacheService";
import { groupByCurrency } from "@/utils/currency";
import { formatDate, getDateGroupTitle } from "@/utils/formatDate";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import { differenceInDays, format, parseISO } from "date-fns";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter
} from "expo-router";
import {
  Archive,
  CirclePlus,
  ListPlus,
  ScanLine,
  X
} from "lucide-react-native";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  RefreshControl,
  useColorScheme
} from "react-native";
import { SwipeListView } from "react-native-swipe-list-view";

const tabs = ["Settlements", "Expenses", "Stats", "Group Info"] as const;

export default function GroupDetailsScreen() {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [settlementRefreshTrigger, setSettlementRefreshTrigger] = useState(0);
  const [archiving, setArchiving] = useState(false);
  const [showArchiveBanner, setShowArchiveBanner] = useState(true);
  const [leaveSheetOpen, setLeaveSheetOpen] = useState(false);
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Settlements");

  const {
    details: groupDetails,
    expenseList,
    settlementList,
    memberList
  } = states.group();
  const { details: userDetails, defaultCurrency } = states.user();

  // A split needs at least two people, so expenses are gated until the group
  // has a second member (joined via invite, or added as a phone contact).
  const canAddExpense = memberList.length >= 2;

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
  const params = useLocalSearchParams();
  const groupId = params.groupId as string | undefined;

  useEffect(() => {
    const incoming = params.tab as (typeof tabs)[number] | undefined;
    if (incoming && tabs.includes(incoming)) {
      setTab(incoming);
    }
  }, [params.tab]);

  const toast = useAppToast();
  const ensureOnline = useEnsureOnline();

  useFocusEffect(
    useMemo(
      () => () => {
        if (!groupId) {
          router.replace("/groups");
          return;
        }

        // Read details from the store (not the reactive value) so clearing
        // `details` on delete doesn't recreate this callback and re-run the
        // focus effect while the screen is still focused — that re-run would
        // call init(), find the group gone, and fire a second router.replace,
        // triggering the back-to-groups animation twice.
        const initialized = states.group.getState().details?.id === groupId;
        init(groupId, initialized);
      },
      [groupId]
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
      const cached = await cacheService
        .getGroupDetail(groupId)
        .catch(() => null);
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
      const deleteResponse = await services.expense.deleteExpense(
        expenseId,
        groupId!
      );

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
    // Drafts are pinned to the top in their own section; the rest are grouped
    // by date as usual.
    const drafts = expenseList.filter((item) => item.is_draft);
    const finalized = expenseList.filter((item) => !item.is_draft);

    const groupedByDate: { [key: string]: typeof expenseList } = {};

    finalized.forEach((item) => {
      const createdAt = item.created_at || new Date().toISOString();
      const dateKey = format(parseISO(createdAt), "yyyy-MM-dd");

      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = [];
      }
      groupedByDate[dateKey].push(item);
    });

    const dateSections = Object.keys(groupedByDate)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .map((dateKey) => ({
        title: getDateGroupTitle(dateKey + "T00:00:00"),
        data: groupedByDate[dateKey].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      }));

    if (drafts.length === 0) {
      return dateSections;
    }

    const draftSection = {
      title: "Drafts",
      data: drafts.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    };

    return [draftSection, ...dateSections];
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

  const handleDeleteGroup = async () => {
    await services.group.deleteGroup(groupId!);
    states.group.setState((prev) => ({
      ...prev,
      list: prev.list.filter((g) => g.id !== groupId),
      details: null,
      memberList: [],
      expenseList: [],
      settlementList: []
    }));
    toast({
      title: "Group deleted",
      description: "The group has been permanently deleted.",
      type: "success"
    });
    router.replace("/groups");
  };

  // A group needs at least two members before an expense can be added. Returns
  // false (and surfaces the reason) when blocked, so callers can bail early.
  const ensureCanAddExpense = () => {
    if (!canAddExpense) {
      toast({
        title: "Add a member first",
        description:
          "A group needs at least two members before you can add an expense. Add someone from Group Info → Edit Members.",
        type: "info"
      });
      return false;
    }
    return true;
  };

  // Toggles the add-expense speed-dial (used by both the iOS native toolbar
  // button and the Android FAB). Gated the same way when opening.
  const handleFabPress = () => {
    if (!fabOpen && !ensureCanAddExpense()) return;
    setFabOpen((prev) => !prev);
  };

  return (
    <Fragment>
      <InnerLayout
        title="Group Details"
        onBack={handleBack}
        gestureEnabled={false}
        actions={
          loading ? undefined : isAdmin ? (
            [
              !groupDetails?.archived && groupDetails?.invite_token ? (
                <Stack.Toolbar.Button
                  key="share"
                  icon="square.and.arrow.up"
                  tintColor={getSecondaryHex("text-secondary-950", colorScheme)}
                  accessibilityLabel="Share group invite"
                  onPress={() => router.push(`/groups/${groupId}/share`)}
                />
              ) : null,
              <Stack.Toolbar.Menu
                key="menu"
                icon="ellipsis"
                tintColor={getSecondaryHex("text-secondary-950", colorScheme)}
                accessibilityLabel="More group options"
              >
                {!groupDetails?.archived && (
                  <Stack.Toolbar.MenuAction
                    icon="pencil"
                    onPress={() => router.push(`/groups/${groupId}/edit`)}
                  >
                    Edit
                  </Stack.Toolbar.MenuAction>
                )}
                <Stack.Toolbar.MenuAction
                  icon="rectangle.portrait.and.arrow.right"
                  onPress={() => setLeaveSheetOpen(true)}
                >
                  Leave Group
                </Stack.Toolbar.MenuAction>
                {groupDetails?.archived ? (
                  <Stack.Toolbar.MenuAction
                    icon="tray.and.arrow.up"
                    onPress={handleUnarchiveGroup}
                  >
                    Unarchive
                  </Stack.Toolbar.MenuAction>
                ) : (
                  <Stack.Toolbar.MenuAction
                    icon="archivebox"
                    onPress={handleArchiveGroup}
                  >
                    Archive
                  </Stack.Toolbar.MenuAction>
                )}
                <Stack.Toolbar.MenuAction
                  icon="trash"
                  destructive
                  onPress={() => setDeleteSheetOpen(true)}
                >
                  Delete Group
                </Stack.Toolbar.MenuAction>
              </Stack.Toolbar.Menu>
            ]
          ) : (
            <Stack.Toolbar.Button
              icon="rectangle.portrait.and.arrow.right"
              tintColor={getSecondaryHex("text-secondary-950", colorScheme)}
              accessibilityLabel="Leave group"
              onPress={() => setLeaveSheetOpen(true)}
            />
          )
        }
      >
        {(tab === "Expenses" || tab === "Settlements") &&
          !groupDetails?.archived && (
            <>
              {/* Speed-dial rendered in a Modal so its dim masks the WHOLE
                  window — including the native header and bottom toolbar —
                  not just the scrollable content. Backdrop and menu are
                  siblings so a tap on the menu's padding doesn't fall through
                  to the dismiss handler. */}
              <Modal
                visible={fabOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setFabOpen(false)}
              >
                <Pressable
                  onPress={() => setFabOpen(false)}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(0,0,0,0.5)"
                  }}
                />
                <Box
                  className="absolute bottom-28 right-4"
                  style={{
                    width: 240,
                    borderRadius: 14,
                    overflow: "hidden",
                    backgroundColor:
                      colorScheme === "dark" ? "#2C2C2E" : "#FFFFFF",
                    shadowColor: "#000",
                    shadowOpacity: 0.2,
                    shadowRadius: 16,
                    shadowOffset: { width: 0, height: 6 },
                    elevation: 8
                  }}
                >
                  <Pressable
                    className="flex-row items-center justify-between px-4 py-3.5 active:opacity-60"
                    onPress={() => {
                      setFabOpen(false);
                      router.push(`/groups/${groupId}/add-expense` as any);
                    }}
                  >
                    <Text className="text-base">Add Expense</Text>
                    <ListPlus
                      size={20}
                      color={getPrimaryHex("text-primary-500", colorScheme)}
                    />
                  </Pressable>
                  <Box
                    style={{
                      height: 0.5,
                      backgroundColor:
                        colorScheme === "dark" ? "#3A3A3C" : "#E5E5EA"
                    }}
                  />
                  <Pressable
                    className="flex-row items-center justify-between px-4 py-3.5 active:opacity-60"
                    onPress={async () => {
                      setFabOpen(false);
                      if (
                        !(await ensureOnline(
                          "You need an internet connection to scan a receipt. Please try again when you're back online."
                        ))
                      ) {
                        return;
                      }
                      router.push(`/groups/${groupId}/scan-receipt` as any);
                    }}
                  >
                    <HStack className="items-center gap-x-2">
                      <Text className="text-base">Scan Receipt</Text>
                      <Badge size="sm" action="info" variant="solid">
                        <BadgeText>Beta</BadgeText>
                      </Badge>
                    </HStack>
                    <ScanLine
                      size={20}
                      color={getPrimaryHex("text-primary-500", colorScheme)}
                    />
                  </Pressable>
                </Box>
              </Modal>

              {Platform.OS === "ios" ? (
                <Stack.Toolbar placement="bottom">
                  <Stack.Toolbar.Spacer />
                  <Stack.Toolbar.Button
                    icon={fabOpen ? "xmark" : "plus"}
                    variant="prominent"
                    tintColor={getPrimaryHex("text-primary-500", colorScheme)}
                    accessibilityLabel={
                      fabOpen ? "Close add menu" : "Add expense"
                    }
                    onPress={handleFabPress}
                  />
                </Stack.Toolbar>
              ) : (
                <Fab
                  placement="bottom right"
                  className="px-6"
                  isHovered={false}
                  isDisabled={false}
                  isPressed={false}
                  onPress={handleFabPress}
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
              )}
            </>
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
            <VStack className="gap-y-6 py-4">
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
              <HStack className="mx-4 mb-4 p-4 rounded-xl bg-secondary-100 gap-x-2 items-start">
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
                renderHiddenItem={({ item }, rowMap) => {
                  const isCreator = item.creator?.id === userDetails?.id;
                  const isPayer = item.payer_list.some(
                    (payer) => payer.payer.id === userDetails?.id
                  );

                  // Mirror the detail screen's guards: only the creator may
                  // delete a draft; anyone who paid may delete a finalized
                  // expense. Editing is the creator's alone and only while no
                  // settlement has moved past "pending".
                  const deletable = item.is_draft ? isCreator : isPayer;
                  const editable =
                    isCreator &&
                    !item.is_draft &&
                    !item.has_settlement_progress;

                  if (!deletable && !editable) return null;

                  return (
                    <HStack className="flex-1 justify-end items-center flex-row px-4 gap-x-2 bg-background-50">
                      {editable && (
                        <Button
                          variant="solid"
                          action="primary"
                          className="rounded-full h-[40] w-[40] p-0"
                          onPress={() => {
                            rowMap[item.id]?.closeRow();
                            router.push(
                              `/groups/${groupId}/${item.id}/edit` as any
                            );
                          }}
                        >
                          <Icon
                            as="edit"
                            size={20}
                            className="text-background-0"
                          />
                        </Button>
                      )}
                      {deletable && (
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
                      )}
                    </HStack>
                  );
                }}
                rightOpenValue={-122}
                renderSectionHeader={({ section: { title } }) => (
                  <Box className="bg-background-50 px-4 py-2 border-b border-secondary-100">
                    <Text className="text-sm text-secondary-950">{title}</Text>
                  </Box>
                )}
                ItemSeparatorComponent={ListDivider}
                stickySectionHeadersEnabled={true}
                ListEmptyComponent={() =>
                  canAddExpense ? (
                    <EmptyList type={EmptyType.EXPENSE} />
                  ) : (
                    <EmptyList
                      type={EmptyType.EXPENSE}
                      content=" This group has no other members yet. Add members from
                        Group Info → Edit Members to start splitting expenses."
                    />
                  )
                }
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

        {/* Compact sticky stats — Settlements tab only. Pinned just under the
            native header as an absolute overlay that fades in once the group
            header scrolls away. Like the overview screen, it animates only
            opacity + translateY (never height) and stays non-interactive, so
            it never reflows the list and scroll/touches pass through. */}
        {tab === "Settlements" && (
          <Animated.View
            pointerEvents="none"
            className="absolute top-0 left-0 right-0 bg-background-0"
            style={{
              opacity: compactOpacity,
              transform: [{ translateY: compactTranslateY }],
              borderBottomWidth: 1,
              borderBottomColor: "rgba(0,0,0,0.06)"
            }}
          >
            <HStack className="px-6 py-3 gap-x-4 items-center justify-center">
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
      <DeleteGroupSheet
        isOpen={deleteSheetOpen}
        onClose={() => setDeleteSheetOpen(false)}
        onDelete={handleDeleteGroup}
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
          <HStack className="gap-x-1 items-center">
            {expense.pending && (
              <Icon as="sync" size={14} className="text-primary-400" />
            )}
            {expense.is_draft ? (
              <Badge
                size="sm"
                variant="solid"
                className="rounded-full bg-warning-50 px-3"
              >
                <BadgeText className="font-bold text-xs uppercase text-warning-600">
                  Draft
                </BadgeText>
              </Badge>
            ) : (
              <>
                <Text className="text-sm text-secondary-950">Paid by</Text>
                <AppAvatarGroup items={formattedPayers} size="xs" />
              </>
            )}
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
