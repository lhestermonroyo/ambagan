import AndroidHeaderMenu, {
  type AndroidHeaderMenuItem
} from "@/components/AndroidHeaderMenu";
import AppAvatar from "@/components/AppAvatar";
import AppAvatarGroup from "@/components/AppAvatarGroup";
import CategoryIcon from "@/components/CategoryIcon";
import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import ListDivider from "@/components/ListDivider";
import LoadingWrapper from "@/components/LoadingWrapper";
import PressableListItem from "@/components/PressableListItem";
import ProBadge from "@/components/ProBadge";
import SearchInput from "@/components/SearchInput";
import { ExpenseListSkeleton } from "@/components/SkeletonLoader";
import UpgradeSheet from "@/components/UpgradeSheet";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Fab } from "@/components/ui/fab";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import CategorySheet, {
  ALL_CATEGORIES,
  categoryFilterLabel,
  categoryFilterOptions,
  expenseCategoryMeta
} from "@/features/expense/components/CategorySheet";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import DateRangeSheet, {
  CustomDateRange,
  DateRangeOption,
  formatDateRangeLabel,
  getDateRangeBounds,
  isWithinRange
} from "@/features/group/components/DateRangeSheet";
import DeleteGroupSheet from "@/features/group/components/DeleteGroupSheet";
import GroupDetailsTab from "@/features/group/components/GroupDetailsTab";
import GroupSettlements from "@/features/group/components/GroupSettlements";
import GroupStatsTab from "@/features/group/components/GroupStatsTab";
import LeaveGroupSheet from "@/features/group/components/LeaveGroupSheet";
import PayerSheet, {
  PayerOption
} from "@/features/group/components/PayerSheet";
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
import { BASE_CURRENCY, useConvertedTotal } from "@/utils/fx";
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
  ArchiveRestore,
  CalendarRange,
  ChevronDown,
  ListPlus,
  LogOut,
  Pencil,
  Plus,
  Repeat,
  ScanLine,
  Search,
  Share2,
  Tag,
  Trash2,
  X
} from "lucide-react-native";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  LayoutAnimation,
  Modal,
  Platform,
  RefreshControl,
  SectionList,
  UIManager,
  useColorScheme
} from "react-native";

// LayoutAnimation needs to be opted into on old-architecture Android; it's a
// no-op elsewhere. Guards the row swap when opening/closing expense search.
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const tabs = ["Settlements", "Expenses", "Stats", "Info"] as const;

export default function GroupDetailsScreen() {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [settlementRefreshTrigger, setSettlementRefreshTrigger] = useState(0);
  const [recurringRefreshTrigger, setRecurringRefreshTrigger] = useState(0);
  const [activeRecurringCount, setActiveRecurringCount] = useState(0);
  const [archiving, setArchiving] = useState(false);
  const [showArchiveBanner, setShowArchiveBanner] = useState(true);
  const [leaveSheetOpen, setLeaveSheetOpen] = useState(false);
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Settlements");

  // Expenses tab filters, mirroring the Settlements tab: a payer pill that opens
  // a bottom sheet, plus search + category + date-range icon buttons. Search
  // matches the description; the payer filter narrows to expenses the user paid;
  // the date range clamps on created_at (the field the list groups its date
  // headers by).
  const [expenseSearch, setExpenseSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [payerFilter, setPayerFilter] = useState<PayerOption>("All");
  const [payerSheetOpen, setPayerSheetOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL_CATEGORIES);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [expenseDateRange, setExpenseDateRange] =
    useState<DateRangeOption>("All");
  const [expenseCustomRange, setExpenseCustomRange] =
    useState<CustomDateRange | null>(null);
  const [dateRangeSheetOpen, setDateRangeSheetOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const {
    details: groupDetails,
    expenseList,
    settlementList,
    memberList
  } = states.group();
  const { details: userDetails } = states.user();

  const isPro = userDetails?.plan === "pro";

  // This group's own home currency drives which balance line surfaces first (a
  // JPY trip group shows JPY first). Falls back to the app's home currency
  // until the group detail loads / for legacy rows.
  const primaryCurrency = groupDetails?.currency ?? BASE_CURRENCY;

  // A split needs at least two people, so expenses are gated until the group
  // has a second member (joined via invite, or added as a phone contact).
  const canAddExpense = memberList.length >= 2;

  const router = useRouter();
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";

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

  // Mirrors the Settlements-tab hero it fades in from, so it converts on the
  // same terms — a "Net" that disagreed with the card above it would read as a
  // bug.
  const compactNet = useConvertedTotal(compactNetBalance, primaryCurrency);

  const compactCollect = useConvertedTotal(compactToCollect, primaryCurrency);
  const compactPay = useConvertedTotal(compactToPay, primaryCurrency);

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

  // Keep the Expenses tab's recurring entry-row count fresh. The list itself
  // lives on the standalone /recurring route; here we only need the active
  // series count, refetched on focus and on pull-to-refresh.
  useFocusEffect(
    useMemo(
      () => () => {
        if (!groupId) return;
        services.expense
          .getRecurringByGroupId(groupId)
          .then((list) =>
            setActiveRecurringCount(list.filter((r) => r.is_active).length)
          )
          .catch(() => setActiveRecurringCount(0));
      },
      [groupId, recurringRefreshTrigger]
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
    setRecurringRefreshTrigger((prev) => prev + 1);
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
    } catch {
      toast({
        title: "Error",
        description: "Failed to restore group. Please try again.",
        type: "error"
      });
    } finally {
      setArchiving(false);
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

  // Recurring expenses are Pro. Free users get the upgrade sheet; Pro users go
  // to the manage screen. Mirrors the personal book detail gating.
  const handleOpenRecurring = () => {
    if (!isPro) {
      setUpgradeOpen(true);
      return;
    }
    router.push(`/groups/${groupId}/recurring`);
  };

  const hasActiveFilters =
    expenseSearch.trim().length > 0 ||
    payerFilter !== "All" ||
    categoryFilter !== ALL_CATEGORIES ||
    expenseDateRange !== "All";

  const filteredExpenseList = useMemo(() => {
    const query = expenseSearch.trim().toLowerCase();
    const { start: cutoff, end: until } = getDateRangeBounds(
      expenseDateRange,
      expenseCustomRange
    );

    return expenseList.filter((item) => {
      if (query && !item.description?.toLowerCase().includes(query)) {
        return false;
      }
      if (
        payerFilter === "Me" &&
        !item.payer_list.some((p) => p.payer.id === userDetails?.id)
      ) {
        return false;
      }
      if (
        categoryFilter !== ALL_CATEGORIES &&
        item.category !== categoryFilter
      ) {
        return false;
      }
      if (!isWithinRange(new Date(item.created_at || 0), cutoff, until)) {
        return false;
      }
      return true;
    });
  }, [
    expenseList,
    expenseSearch,
    payerFilter,
    categoryFilter,
    expenseDateRange,
    expenseCustomRange,
    userDetails?.id
  ]);

  // Swap the payer/filter row for the full-width search field (and back). The
  // query is kept when collapsing so it persists as a chip, mirroring how the
  // Settlements tab's search behaves.
  const toggleExpenseSearch = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSearchOpen((prev) => !prev);
  };

  const formattedExpenseList = useMemo(() => {
    // Drafts are pinned to the top in their own section; the rest are grouped
    // by date as usual.
    const drafts = filteredExpenseList.filter((item) => item.is_draft);
    const finalized = filteredExpenseList.filter((item) => !item.is_draft);

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
  }, [filteredExpenseList]);

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
    } catch {
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

  // Android counterpart to the iOS `actions` toolbar: an optional share icon
  // button plus the overflow menu, mirroring the same admin / archived rules.
  const renderGroupAndroidActions = () => {
    if (loading) return undefined;

    const iconColor = getSecondaryHex("text-secondary-950", colorScheme);

    const menuItems: AndroidHeaderMenuItem[] = isAdmin
      ? [
          ...(!groupDetails?.archived
            ? [
                {
                  key: "edit",
                  label: "Edit",
                  icon: Pencil,
                  onPress: () => router.push(`/groups/${groupId}/edit`)
                }
              ]
            : []),
          {
            key: "leave",
            label: "Leave Group",
            icon: LogOut,
            onPress: () => setLeaveSheetOpen(true)
          },
          groupDetails?.archived
            ? {
                key: "unarchive",
                label: "Unarchive",
                icon: ArchiveRestore,
                onPress: handleUnarchiveGroup
              }
            : {
                key: "archive",
                label: "Archive",
                icon: Archive,
                onPress: handleArchiveGroup
              },
          {
            key: "delete",
            label: "Delete Group",
            icon: Trash2,
            destructive: true,
            onPress: () => setDeleteSheetOpen(true)
          }
        ]
      : [
          {
            key: "leave",
            label: "Leave Group",
            icon: LogOut,
            onPress: () => setLeaveSheetOpen(true)
          }
        ];

    const showShare =
      isAdmin && !groupDetails?.archived && !!groupDetails?.invite_token;

    return (
      <HStack className="items-center gap-x-8 pr-1">
        {showShare && (
          <Pressable
            aria-label="Share group invite"
            onPress={() => router.push(`/groups/${groupId}/share`)}
          >
            <Share2 size={22} color={iconColor} />
          </Pressable>
        )}
        <AndroidHeaderMenu
          accessibilityLabel="More group options"
          items={menuItems}
        />
      </HStack>
    );
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
            <Stack.Toolbar.Menu
              icon="ellipsis"
              tintColor={getSecondaryHex("text-secondary-950", colorScheme)}
              accessibilityLabel="More group options"
            >
              <Stack.Toolbar.MenuAction
                icon="rectangle.portrait.and.arrow.right"
                onPress={() => setLeaveSheetOpen(true)}
              >
                Leave Group
              </Stack.Toolbar.MenuAction>
            </Stack.Toolbar.Menu>
          )
        }
        androidActions={renderGroupAndroidActions()}
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
                  className="absolute bottom-24 right-4"
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
                // Icon-only round FAB, mirroring the iOS prominent "+" — no
                // label, toggling to an "X" while the speed-dial is open.
                <Fab
                  placement="bottom right"
                  className="bottom-10"
                  isHovered={false}
                  isDisabled={false}
                  isPressed={false}
                  aria-label={fabOpen ? "Close add menu" : "Add expense"}
                  onPress={handleFabPress}
                >
                  {fabOpen ? (
                    <X
                      size={24}
                      color={getSecondaryHex("text-secondary-0", colorScheme)}
                    />
                  ) : (
                    <Plus
                      size={24}
                      color={getSecondaryHex("text-secondary-0", colorScheme)}
                    />
                  )}
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
                    {formatDate(groupDetails?.created_at || "")} •{" "}
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
                <HStack className="mx-4 mb-4 p-4 rounded-xl bg-primary-50 items-start gap-x-2">
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
              <VStack className="pb-2 gap-y-4">
                <Pressable
                  className="mx-4 bg-secondary-100 rounded-lg p-4 data-[hover=true]:bg-secondary-200 data-[active=true]:bg-secondary-200"
                  onPress={handleOpenRecurring}
                >
                  <HStack className="items-start gap-x-2">
                    <Repeat
                      size={24}
                      color={getPrimaryHex("text-primary-500", colorScheme)}
                    />
                    <HStack className="flex-1 items-center">
                      <VStack className="flex-1">
                        <HStack className="items-center gap-x-2">
                          <Text className="text-lg" bold>
                            Recurring expenses
                          </Text>
                          {!isPro && <ProBadge />}
                        </HStack>
                        <Text className="text-sm text-secondary-950">
                          {activeRecurringCount > 0
                            ? `${activeRecurringCount} active series`
                            : "Auto-post expenses on a schedule"}
                        </Text>
                      </VStack>
                      <Icon as="chevron-right" className="text-secondary-950" />
                    </HStack>
                  </HStack>
                </Pressable>
                <VStack className="gap-y-4">
                  {searchOpen ? (
                    <HStack className="px-4 items-center gap-x-2">
                      <Box className="flex-1">
                        <SearchInput
                          autoFocus
                          value={expenseSearch}
                          onChangeText={setExpenseSearch}
                          placeholder="Search expenses"
                        />
                      </Box>
                      <FormButton
                        size="md"
                        variant="link"
                        text="Cancel"
                        onPress={toggleExpenseSearch}
                      />
                    </HStack>
                  ) : (
                    <HStack className="px-4 items-center justify-between">
                      <FormButton
                        size="sm"
                        variant="outline"
                        text={payerFilter === "All" ? "Everyone" : "Paid by me"}
                        iconEnd={
                          <ChevronDown
                            size={16}
                            color={getPrimaryHex(
                              "text-primary-500",
                              colorScheme
                            )}
                          />
                        }
                        onPress={() => setPayerSheetOpen(true)}
                      />
                      <HStack className="gap-x-6 items-center">
                        <Button
                          variant="link"
                          className="rounded-full"
                          onPress={toggleExpenseSearch}
                        >
                          <Search
                            color={
                              expenseSearch
                                ? getPrimaryHex("text-primary-400", colorScheme)
                                : getSecondaryHex(
                                    "text-secondary-950",
                                    colorScheme
                                  )
                            }
                          />
                        </Button>
                        <Button
                          variant="link"
                          className="rounded-full"
                          onPress={() => setCategorySheetOpen(true)}
                        >
                          <Tag
                            color={
                              categoryFilter !== ALL_CATEGORIES
                                ? getPrimaryHex("text-primary-400", colorScheme)
                                : getSecondaryHex(
                                    "text-secondary-950",
                                    colorScheme
                                  )
                            }
                          />
                        </Button>
                        <Button
                          variant="link"
                          className="rounded-full"
                          onPress={() => setDateRangeSheetOpen(true)}
                        >
                          <CalendarRange
                            color={
                              expenseDateRange !== "All"
                                ? getPrimaryHex("text-primary-400", colorScheme)
                                : getSecondaryHex(
                                    "text-secondary-950",
                                    colorScheme
                                  )
                            }
                          />
                        </Button>
                      </HStack>
                    </HStack>
                  )}

                  {(expenseDateRange !== "All" ||
                    categoryFilter !== ALL_CATEGORIES ||
                    (!!expenseSearch && !searchOpen)) && (
                    <HStack className="gap-x-2 px-4 flex-wrap">
                      {!!expenseSearch && !searchOpen && (
                        <Pressable
                          onPress={() => setExpenseSearch("")}
                          className="flex-row items-center gap-x-1 bg-primary-100 border border-primary-200 rounded-full px-3 py-1"
                        >
                          <Text
                            className="text-sm text-primary-600 max-w-[160px]"
                            numberOfLines={1}
                          >
                            &ldquo;{expenseSearch}&rdquo;
                          </Text>
                          <X
                            size={12}
                            color={getPrimaryHex(
                              "text-primary-600",
                              colorScheme
                            )}
                          />
                        </Pressable>
                      )}
                      {categoryFilter !== ALL_CATEGORIES && (
                        <Pressable
                          onPress={() => setCategoryFilter(ALL_CATEGORIES)}
                          className="flex-row items-center gap-x-1 bg-primary-100 border border-primary-200 rounded-full px-3 py-1"
                        >
                          <Text className="text-sm text-primary-600">
                            {categoryFilterLabel(categoryFilter)}
                          </Text>
                          <X
                            size={12}
                            color={getPrimaryHex(
                              "text-primary-600",
                              colorScheme
                            )}
                          />
                        </Pressable>
                      )}
                      {expenseDateRange !== "All" && (
                        <Pressable
                          onPress={() => {
                            setExpenseDateRange("All");
                            setExpenseCustomRange(null);
                          }}
                          className="flex-row items-center gap-x-1 bg-primary-100 border border-primary-200 rounded-full px-3 py-1"
                        >
                          <Text className="text-sm text-primary-600">
                            {formatDateRangeLabel(
                              expenseDateRange,
                              expenseCustomRange
                            )}
                          </Text>
                          <X
                            size={12}
                            color={getPrimaryHex(
                              "text-primary-600",
                              colorScheme
                            )}
                          />
                        </Pressable>
                      )}
                    </HStack>
                  )}
                </VStack>
                {/* Plain list — edit/delete live on the expense detail screen,
                    which gates them per expense. Surfacing them as swipe
                    actions here meant a settled expense revealed a lone delete
                    button. */}
                <SectionList
                  className="flex-1"
                  scrollEnabled={false}
                  sections={formattedExpenseList}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }: { item: ExpensePreview }) => (
                    <ExpenseItem
                      key={item.id}
                      expense={item}
                      onOpen={() =>
                        router.push(`/groups/${groupId}/${item.id}`)
                      }
                    />
                  )}
                  renderSectionHeader={({ section: { title } }) => (
                    <Box className="bg-background-50 px-4 py-2 border-b border-secondary-100">
                      <Text className="text-sm text-secondary-950">
                        {title}
                      </Text>
                    </Box>
                  )}
                  ItemSeparatorComponent={ListDivider}
                  stickySectionHeadersEnabled={true}
                  ListEmptyComponent={() =>
                    hasActiveFilters ? (
                      <EmptyList
                        type={EmptyType.EXPENSE}
                        content="No expenses match your filters. Try adjusting your search, payer, category, or date range."
                      />
                    ) : canAddExpense ? (
                      <EmptyList type={EmptyType.EXPENSE} />
                    ) : (
                      <EmptyList
                        type={EmptyType.EXPENSE}
                        content=" This group has no other members yet. Add members from
                        Info → Edit Members to start splitting expenses."
                      />
                    )
                  }
                  ListFooterComponent={() => <Box className="h-16" />}
                />
              </VStack>
            )}
            {tab === "Info" && <GroupDetailsTab />}
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
                <Text
                  className="text-secondary-950 text-sm uppercase tracking-widest"
                  numberOfLines={1}
                >
                  Net
                </Text>
                <Text
                  bold
                  className={`text-lg ${
                    compactNet.total < 0 ? "text-error-400" : ""
                  }`}
                >
                  {compactNet.convertedCurrencies.length > 0 ? "≈ " : ""}
                  {formatAmount(compactNet.total, primaryCurrency)}
                </Text>
              </VStack>
              <Text className="text-secondary-200">|</Text>
              <VStack className="items-center flex-1">
                <Text
                  className="text-secondary-950 text-sm uppercase tracking-widest"
                  numberOfLines={1}
                >
                  Collect
                </Text>
                <Text bold className="text-lg" numberOfLines={1}>
                  {compactCollect.convertedCurrencies.length > 0 ? "≈ " : ""}
                  {formatAmount(compactCollect.total, primaryCurrency)}
                </Text>
              </VStack>
              <Text className="text-secondary-200">|</Text>
              <VStack className="items-center flex-1">
                <Text
                  className="text-secondary-950 text-sm uppercase tracking-widest"
                  numberOfLines={1}
                >
                  Pay
                </Text>
                <Text bold className="text-lg text-error-400" numberOfLines={1}>
                  {compactPay.convertedCurrencies.length > 0 ? "≈ " : ""}
                  {formatAmount(compactPay.total, primaryCurrency)}
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
      <PayerSheet
        isOpen={payerSheetOpen}
        onClose={() => setPayerSheetOpen(false)}
        payer={payerFilter}
        onSelect={setPayerFilter}
      />
      <CategorySheet
        isOpen={categorySheetOpen}
        onClose={() => setCategorySheetOpen(false)}
        category={categoryFilter}
        onSelect={setCategoryFilter}
        options={categoryFilterOptions}
      />
      <DateRangeSheet
        isOpen={dateRangeSheetOpen}
        onClose={() => setDateRangeSheetOpen(false)}
        dateRange={expenseDateRange}
        customRange={expenseCustomRange}
        onSelect={(value, custom) => {
          setExpenseDateRange(value);
          setExpenseCustomRange(custom ?? null);
        }}
      />
      <UpgradeSheet
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        description="Recurring expenses are a Pro feature. Upgrade to auto-post monthly rent, subscriptions, and other regular bills on a schedule."
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

  const sortedPayers = useMemo(() => {
    const list = expense.payer_list;
    const userPayer = list.find((p) => p.payer.id === userDetails?.id);
    return userPayer
      ? [userPayer, ...list.filter((p) => p !== userPayer)]
      : list;
  }, [expense.payer_list, userDetails?.id]);

  const formattedPayers = useMemo(
    () =>
      sortedPayers.map((item) => ({
        id: item.payer.id,
        name: item.payer.first_name,
        uri: item.payer.avatar || undefined
      })),
    [sortedPayers]
  );

  const payerLabel = useMemo(() => {
    if (!sortedPayers.length) return "";

    const lead = sortedPayers[0].payer;
    const leadName =
      lead.id === userDetails?.id
        ? `${lead.first_name} (You)`
        : lead.first_name;

    const othersCount = sortedPayers.length - 1;
    return othersCount > 0
      ? `${leadName} and ${othersCount} other${othersCount > 1 ? "s" : ""}`
      : leadName;
  }, [sortedPayers, userDetails?.id]);

  return (
    <PressableListItem onPress={onOpen} className="p-4">
      <HStack className="items-start gap-x-3 rounded-lg">
        <CategoryIcon icon={expenseCategoryMeta(expense.category).icon} />
        <HStack className="flex-1 gap-x-2 items-center">
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
                  <Text
                    className="flex-1 text-sm text-secondary-950"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {payerLabel}
                  </Text>
                </>
              )}
            </HStack>
          </VStack>
          <VStack className="items-end gap-y-1">
            <Text className="text-lg font-medium text-right">
              {formatAmount(expense.amount, expense.currency)}
            </Text>
          </VStack>
          <Icon as="chevron-right" className="text-secondary-950" />
        </HStack>
      </HStack>
    </PressableListItem>
  );
}
