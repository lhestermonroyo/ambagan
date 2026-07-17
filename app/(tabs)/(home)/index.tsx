import AppAvatar from "@/components/AppAvatar";
import CurrencyCountButton from "@/components/CurrencyCountButton";
import EmptyList from "@/components/EmptyList";
import ListDivider from "@/components/ListDivider";
import LoadingWrapper from "@/components/LoadingWrapper";
import {
  FriendCardListSkeleton,
  GroupListSkeleton,
  SettlementListSkeleton
} from "@/components/SkeletonLoader";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import {
  ScrollView as HScrollView,
  ScrollView
} from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import QuickAddExpenseSheet from "@/features/expense/components/QuickAddExpenseSheet";
import SettlementActionSheet from "@/features/expense/components/SettlementActionSheet";
import SettlementAvatar from "@/features/expense/components/SettlementAvatar";
import SettlementItem from "@/features/expense/components/SettlementItem";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import GroupItem from "@/features/group/components/GroupItem";
import { defaultExpenseGroup } from "@/features/group/utils/groupMembers";
import services from "@/services";
import states from "@/states";
import { FriendSummary, PaymentPreview } from "@/types/expenses";
import { EmptyType } from "@/types/general";
import { getPrimaryHex } from "@/utils/getColorHex";
import { prefetchGroupDetails } from "@/utils/offlinePrefetch";
import { addRecentUsers } from "@/utils/recentUsers";
import { getReminderEnabled } from "@/utils/reminderPreference";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import * as Notifications from "expo-notifications";
import { Stack, useFocusEffect, useIsFocused, useRouter } from "expo-router";
import {
  Bell,
  CircleQuestionMark,
  HousePlus,
  ListPlus,
  QrCode,
  Zap
} from "lucide-react-native";
import React, {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  Animated,
  InteractionManager,
  Platform,
  RefreshControl,
  useColorScheme
} from "react-native";

const SETTLEMENT_REMINDER_ID = "daily-settlement-reminder";

export default function HomeScreen() {
  const [loading, setLoading] = useState({
    stats: false,
    activities: false,
    groups: false,
    friends: false
  });
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [stats, setStats] = useState<{
    toPay: { currency: string; amount: number }[];
    toReceive: { currency: string; amount: number }[];
  }>({ toPay: [], toReceive: [] });

  const [initialized, setInitialized] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentPreview | null>(
    null
  );
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  // True when Quick Add is opened from a Scan Receipt (Beta) hand-off, so the
  // sheet seeds itself from the scanDraft instead of starting blank.
  const [quickAddSeedScan, setQuickAddSeedScan] = useState(false);

  const {
    details: userDetails,
    session,
    defaultCurrency,
    settlementView
  } = states.user();
  // Use session.user.id as fallback — it's available immediately after login
  // without waiting for fetchDetails to complete
  const userId = userDetails?.id ?? session?.user?.id;
  const { list: groupList } = states.group();
  const { activityList, setPendingQuickAdd } = states.expense();
  const { unreadCount } = states.notification();

  const displayStats = stats;

  const netBalance = useMemo(() => {
    const allCurrencies = new Set([
      ...displayStats.toReceive.map((i) => i.currency),
      ...displayStats.toPay.map((i) => i.currency)
    ]);
    return Array.from(allCurrencies).map((currency) => {
      const receive =
        displayStats.toReceive.find((i) => i.currency === currency)?.amount ??
        0;
      const pay =
        displayStats.toPay.find((i) => i.currency === currency)?.amount ?? 0;
      return { currency, amount: receive - pay };
    });
  }, [displayStats.toReceive, displayStats.toPay]);

  const router = useRouter();
  const liveColorScheme = useColorScheme() ?? "light";
  const isFocused = useIsFocused();

  const [colorScheme, setColorScheme] = useState(liveColorScheme);
  useEffect(() => {
    if (isFocused) setColorScheme(liveColorScheme);
  }, [isFocused, liveColorScheme]);

  const [toolbarUnread, setToolbarUnread] = useState(unreadCount);
  useEffect(() => {
    if (isFocused) setToolbarUnread(unreadCount);
  }, [isFocused, unreadCount]);

  const headerBg = getPrimaryHex("text-primary-400", colorScheme);
  const tintColor = "#fff";

  // Drives the compact net-balance bar that fades in — pinned just under the
  // native header — once the full hero card has scrolled out of view.
  const scrollY = useRef(new Animated.Value(0)).current;

  const primaryNet = useMemo(() => {
    const sorted = [...netBalance].sort((a, b) =>
      a.currency === defaultCurrency
        ? -1
        : b.currency === defaultCurrency
          ? 1
          : 0
    );
    return sorted[0] ?? { currency: defaultCurrency, amount: 0 };
  }, [netBalance, defaultCurrency]);

  const primaryReceive = useMemo(() => {
    const sorted = [...displayStats.toReceive].sort((a, b) =>
      a.currency === defaultCurrency
        ? -1
        : b.currency === defaultCurrency
          ? 1
          : 0
    );
    return sorted[0] ?? { currency: defaultCurrency, amount: 0 };
  }, [displayStats.toReceive, defaultCurrency]);

  const primaryPay = useMemo(() => {
    const sorted = [...displayStats.toPay].sort((a, b) =>
      a.currency === defaultCurrency
        ? -1
        : b.currency === defaultCurrency
          ? 1
          : 0
    );
    return sorted[0] ?? { currency: defaultCurrency, amount: 0 };
  }, [displayStats.toPay, defaultCurrency]);

  // The hero card is ~250pt tall; start the fade partway through so the compact
  // bar is fully in by the time the hero is gone. `contentInsetAdjustmentBehavior`
  // seeds scrollY negative at rest, which only delays the fade — never triggers
  // it early — so a fixed threshold is safe here.
  const COMPACT_THRESHOLD = 200;
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

  useEffect(() => {
    if (!userId) {
      setInitialized(false);
      return;
    }
    setInitialized(false);
    init(false);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      init(initialized);
    }, [userId, initialized])
  );

  const init = async (isInitialized = false) => {
    await Promise.all([
      fetchStats(isInitialized),
      fetchGroups(isInitialized),
      fetchActivities(isInitialized),
      fetchFriends(isInitialized),
      fetchUnreadCount()
    ]).then(() => {
      setInitialized(true);
    });
  };

  const fetchUnreadCount = async () => {
    if (!userId) return;
    try {
      const count = await services.notification.getUnreadCount(userId);
      states.notification.setState((prev) => ({ ...prev, unreadCount: count }));
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    }
  };

  const fetchStats = async (isInitialized = false) => {
    if (!userId) return;

    if (!isInitialized) {
      setLoading((prev) => ({ ...prev, stats: true }));
    }

    try {
      const response = await services.expense.getStatsByUserId(userId);

      if (!response) return;

      setStats({ toPay: response.toPay, toReceive: response.toReceive });
      syncSettlementReminder(response.toPay);
    } catch (error) {
      console.error("Failed to fetch expense statistics:", error);
    } finally {
      setLoading((prev) => ({ ...prev, stats: false }));
    }
  };

  const syncSettlementReminder = async (
    toPay: { currency: string; amount: number }[]
  ) => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== "granted") return;

      const reminderEnabled = await getReminderEnabled();
      if (!reminderEnabled) {
        await Notifications.cancelScheduledNotificationAsync(
          SETTLEMENT_REMINDER_ID
        );
        return;
      }

      if (toPay.length > 0) {
        await Notifications.scheduleNotificationAsync({
          identifier: SETTLEMENT_REMINDER_ID,
          content: {
            title: "You have unpaid settlements",
            body: "Don't forget to settle up with your group members."
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: 9,
            minute: 0
          }
        });
      } else {
        await Notifications.cancelScheduledNotificationAsync(
          SETTLEMENT_REMINDER_ID
        );
      }
    } catch (error) {
      console.error("Failed to sync settlement reminder:", error);
    }
  };

  const fetchActivities = async (isInitialized = false) => {
    if (!userId) return;

    if (!isInitialized) {
      setLoading((prev) => ({ ...prev, activities: true }));
    }

    try {
      const response = await services.expense.getPaymentsByUserId(
        userId,
        0,
        20,
        false
      );

      if (!response || !response.data) return;

      states.expense.setState((prev) => ({
        ...prev,
        activityList: response.data
      }));
    } catch (error) {
      console.error("Failed to fetch recent expenses:", error);
    } finally {
      setLoading((prev) => ({ ...prev, activities: false }));
    }
  };

  const fetchGroups = async (isInitialized = false) => {
    if (!userId) return;

    if (!isInitialized) {
      setLoading((prev) => ({ ...prev, groups: true }));
    }

    try {
      const response = await services.group.getGroupsByUserId(userId);

      if (!response) return;

      states.group.setState((prev) => ({
        ...prev,
        list: response,
        initialized: true
      }));

      // On first load, quietly warm each group's offline cache in the
      // background — deferred until interactions settle so it never competes
      // with rendering or navigation.
      if (!isInitialized && userId) {
        InteractionManager.runAfterInteractions(() => {
          prefetchGroupDetails(userId, response).catch(() => {});
        });
      }
    } catch (error) {
      console.error("Failed to fetch groups:", error);
    } finally {
      setLoading((prev) => ({ ...prev, groups: false }));
    }
  };

  const fetchFriends = async (isInitialized = false) => {
    if (!userId) return;
    if (!isInitialized) setLoading((prev) => ({ ...prev, friends: true }));
    try {
      const data = await services.friend.getFriendsSummary(userId);
      setFriends(data);
      addRecentUsers(
        data.map((f) => f.friend),
        userId
      ).catch(() => {});
    } catch (error) {
      console.error("Failed to fetch friends:", error);
    } finally {
      setLoading((prev) => ({ ...prev, friends: false }));
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await init(true);
    setRefreshing(false);
  };

  // Quick Add defaults to the group the user most recently joined that can
  // actually hold an expense — skip member-less groups (only the creator) so
  // they're never auto-selected. Ranks by the user's own join time (not group
  // creation date) so a group just joined via QR wins over an older self-made one.
  const quickAddGroup = useMemo(
    () => defaultExpenseGroup(groupList, userId),
    [groupList, userId]
  );

  const groupsPreview = useMemo(() => groupList.slice(0, 5), [groupList]);
  const activitiesPreview = useMemo(
    () => activityList.slice(0, 5),
    [activityList]
  );
  const friendsPreview = useMemo(() => friends.slice(0, 5), [friends]);

  const handleOpenActionSheet = useCallback((item: PaymentPreview) => {
    setSelectedPayment(item);
    setActionSheetOpen(true);
  }, []);

  const handleCloseActionSheet = useCallback(
    () => setActionSheetOpen(false),
    []
  );
  const handleRefetch = useCallback(() => init(true), [userId]);

  const handleOpenQuickAdd = useCallback(() => setQuickAddOpen(true), []);
  const handleCloseQuickAdd = useCallback(() => {
    setQuickAddOpen(false);
    setQuickAddSeedScan(false);
  }, []);

  // A scan chose "Quick Add" and returned here — open the sheet seeded from the
  // stashed draft, then clear the flag so it doesn't reopen. Keyed to focus (not
  // the flag) so only the focused screen consumes it: Home stays mounted behind
  // a group route, and both hosts subscribe to the same flag.
  useFocusEffect(
    useCallback(() => {
      if (states.expense.getState().pendingQuickAdd) {
        setQuickAddSeedScan(true);
        setQuickAddOpen(true);
        setPendingQuickAdd(false);
      }
    }, [setPendingQuickAdd])
  );
  const handleOpenScan = useCallback(
    () => router.push("/scan-receipt" as any),
    []
  );

  const handleQuickAddSuccess = useCallback(() => {
    init(true);
    states.group.setState((prev) => ({
      ...prev,
      settlementRefreshToken: prev.settlementRefreshToken + 1
    }));
  }, [userId]);

  const handleCustomExpense = useCallback(() => {
    router.push("/groups/[groupId]/new-expense");
  }, [router]);

  const handleOpenHelp = useCallback(
    () => router.push("/profile/help-center"),
    [router]
  );
  const handleOpenNotifications = useCallback(
    () => router.push("/notifications"),
    [router]
  );

  const renderActivityItem = useCallback(
    ({ item }: { item: PaymentPreview }) => (
      <SettlementItem item={item} onPress={() => handleOpenActionSheet(item)} />
    ),
    [handleOpenActionSheet]
  );

  const renderGroupItem = useCallback(
    ({ item }: { item: (typeof groupList)[0] }) => (
      <GroupItem
        details={item}
        onOpen={() => router.push(`/groups/${item.id}`)}
      />
    ),
    [router]
  );

  return (
    <Fragment>
      <Stack.Screen
        options={{
          headerShown: true,
          headerLargeTitle: false,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: headerBg },
          headerTitle: () => (
            <VStack className="flex-1">
              <Text className="text-sm text-white/70 leading-tight">
                Hello,
              </Text>
              <Text
                bold
                className="text-xl text-white leading-tight"
                numberOfLines={1}
              >
                {userDetails?.first_name} {userDetails?.last_name}
              </Text>
            </VStack>
          ),
          headerRight:
            Platform.OS === "android"
              ? () => (
                  <HStack className="items-center gap-x-4 pr-1">
                    <Button
                      variant="link"
                      className="rounded-full"
                      onPress={handleOpenHelp}
                    >
                      <CircleQuestionMark color={tintColor} />
                    </Button>
                    <Button
                      variant="link"
                      className="rounded-full"
                      onPress={handleOpenNotifications}
                    >
                      <Box className="relative">
                        <Bell color={tintColor} />
                        {unreadCount > 0 && (
                          <Box className="absolute -top-1 -right-1 bg-error-400 rounded-full flex px-1 min-w-4 h-4 items-center justify-center">
                            <Text className="text-white text-2xs font-semibold">
                              {unreadCount > 9 ? "9+" : unreadCount}
                            </Text>
                          </Box>
                        )}
                      </Box>
                    </Button>
                  </HStack>
                )
              : undefined
        }}
      />

      {Platform.OS === "ios" && (
        <HomeToolbar
          buttonBg={headerBg}
          unreadCount={toolbarUnread}
          onHelp={handleOpenHelp}
          onNotifications={handleOpenNotifications}
        />
      )}

      <Box className="flex-1 bg-background-0">
        <Box
          className="absolute top-0 left-0 right-0 bg-primary-400"
          style={{ height: 300 }}
        />
        <ScrollView
          className="flex-1"
          contentInsetAdjustmentBehavior="automatic"
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <VStack className="gap-y-4 bg-background-0 flex-1">
            <Box className="bg-primary-400">
              <VStack className="p-4 gap-y-6">
                <VStack className="gap-y-4">
                  {/* Net Balance Hero */}
                  <NetBalanceRow
                    isLoading={loading.stats}
                    items={netBalance}
                    primaryCurrency={defaultCurrency}
                  />

                  <Divider className="bg-white/20" />

                  {/* Stat Columns */}
                  <HStack className="items-stretch">
                    <StatItem
                      type="RECEIVE"
                      isLoading={loading.stats}
                      items={displayStats.toReceive}
                      primaryCurrency={defaultCurrency}
                    />
                    <Divider
                      orientation="vertical"
                      className="mx-4 bg-white/20"
                    />
                    <StatItem
                      type="PAY"
                      isLoading={loading.stats}
                      items={displayStats.toPay}
                      primaryCurrency={defaultCurrency}
                    />
                  </HStack>
                </VStack>

                {/* Action Buttons stay live for instant entry — the expense
                  flows below handle the still-loading case by skeletoning
                  their own group / payer fields rather than blocking here. */}
                <HStack className="gap-x-2 justify-center">
                  <ActionButton
                    icon={<Zap size={24} color="#fff" />}
                    label={`Quick\n\ Expense`}
                    onPress={handleOpenQuickAdd}
                  />
                  <ActionButton
                    icon={<ListPlus size={24} color="#fff" />}
                    label={`Custom\n\ Expense`}
                    onPress={handleCustomExpense}
                  />

                  <ActionButton
                    icon={<HousePlus size={24} color="#fff" />}
                    label={`Create\n\ Group`}
                    onPress={() => router.push("/groups/create")}
                  />
                  <ActionButton
                    icon={<QrCode size={24} color="#fff" />}
                    label={`Scan to\n\ Join`}
                    onPress={() => router.push("/scan" as any)}
                  />
                </HStack>
              </VStack>
            </Box>

            <VStack>
              <HStack className="items-center justify-between px-4">
                <Text bold className="text-2xl flex-1">
                  Friends
                </Text>
                <Button variant="link" onPress={() => router.push("/friends")}>
                  <Text className="text-primary-400 font-medium">View All</Text>
                </Button>
              </HStack>
              <LoadingWrapper
                isLoading={loading.friends}
                skeleton={<FriendCardListSkeleton />}
              >
                {friends.length > 0 ? (
                  <HScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                  >
                    <HStack className="gap-x-2 px-4">
                      {friendsPreview.map((item) => (
                        <FriendCard
                          key={item.friend.id}
                          item={item}
                          router={router}
                        />
                      ))}
                    </HStack>
                  </HScrollView>
                ) : (
                  <EmptyList type={EmptyType.FRIEND} />
                )}
              </LoadingWrapper>
            </VStack>

            <VStack>
              <HStack className="items-center justify-between px-4">
                <Text bold className="text-2xl">
                  Recent Activities
                </Text>
              </HStack>
              <LoadingWrapper
                isLoading={loading.activities}
                skeleton={<SettlementListSkeleton count={3} />}
              >
                <FlatList
                  key={settlementView}
                  data={activitiesPreview}
                  extraData={settlementView}
                  scrollEnabled={false}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={renderActivityItem}
                  ItemSeparatorComponent={ListDivider}
                  ListEmptyComponent={() => (
                    <EmptyList type={EmptyType.ACTIVITY} />
                  )}
                />
              </LoadingWrapper>
            </VStack>

            <VStack>
              <HStack className="items-center justify-between px-4">
                <Text bold className="text-2xl">
                  Recent Groups
                </Text>
                <Button variant="link" onPress={() => router.push("/groups")}>
                  <Text className="text-primary-400 font-medium">View All</Text>
                </Button>
              </HStack>
              <LoadingWrapper
                isLoading={loading.groups}
                skeleton={<GroupListSkeleton count={3} />}
              >
                <FlatList
                  data={groupsPreview}
                  scrollEnabled={false}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={renderGroupItem}
                  ItemSeparatorComponent={ListDivider}
                  ListEmptyComponent={() => (
                    <EmptyList type={EmptyType.GROUP} />
                  )}
                />
              </LoadingWrapper>
            </VStack>
            <Box
              className="absolute left-0 right-0 bg-background-0"
              style={{ bottom: -500, height: 500 }}
            />
          </VStack>
        </ScrollView>

        {/* Compact net-balance bar — pinned just under the native header, fades
          in as the hero card scrolls away. Purely informational, so it stays
          non-interactive and lets scroll/touches pass through to the list. */}
        <Animated.View
          pointerEvents="none"
          className="absolute top-0 left-0 right-0 bg-primary-400"
          style={{
            opacity: compactOpacity,
            transform: [{ translateY: compactTranslateY }]
          }}
        >
          <HStack className="px-6 py-3 gap-x-4 items-center justify-center">
            <VStack className="items-center flex-1">
              <Text className="text-white/70 text-sm uppercase tracking-widest">
                Net
              </Text>
              <Text bold className="text-white text-lg">
                {formatAmount(primaryNet.amount, primaryNet.currency)}
              </Text>
            </VStack>
            <Text className="text-white/20">|</Text>
            <VStack className="items-center flex-1">
              <Text className="text-white/70 text-sm uppercase tracking-widest">
                Collect
              </Text>
              <Text bold className="text-white text-lg">
                {formatAmount(primaryReceive.amount, primaryReceive.currency)}
              </Text>
            </VStack>
            <Text className="text-white/20">|</Text>
            <VStack className="items-center flex-1">
              <Text className="text-white/70 text-sm uppercase tracking-widest">
                Pay
              </Text>
              <Text bold className="text-white text-lg">
                {formatAmount(primaryPay.amount, primaryPay.currency)}
              </Text>
            </VStack>
          </HStack>
        </Animated.View>
      </Box>
      <SettlementActionSheet
        isOpen={actionSheetOpen}
        onClose={handleCloseActionSheet}
        item={selectedPayment}
        onRefetch={handleRefetch}
      />
      <QuickAddExpenseSheet
        isOpen={quickAddOpen}
        group={quickAddGroup}
        groupsLoading={loading.groups}
        allowGroupChange
        seedFromScan={quickAddSeedScan}
        onClose={handleCloseQuickAdd}
        onSuccess={handleQuickAddSuccess}
      />
    </Fragment>
  );
}

// iOS 26 native toolbar buttons in the `prominent` (filled glass) style —
// `sharesBackground` (expo-router's default) keeps the two in a single grouped
// background rather than two detached capsules.
//
// Memoized so it only re-renders — and therefore only re-registers with the
// native header — when one of its own inputs actually changes. This is what
// keeps a blurred re-render of HomeScreen (e.g. a theme switch made from
// another tab) from recreating the toolbar's children off-screen, which would
// otherwise drop the buttons until a later focus.
const HomeToolbar = React.memo(function HomeToolbar({
  buttonBg,
  unreadCount,
  onHelp,
  onNotifications
}: {
  buttonBg: string;
  unreadCount: number;
  onHelp: () => void;
  onNotifications: () => void;
}) {
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button
        icon="questionmark.circle"
        tintColor={buttonBg}
        accessibilityLabel="Help center"
        onPress={onHelp}
      />
      <Stack.Toolbar.Button
        icon={unreadCount > 0 ? "bell.badge" : "bell"}
        tintColor={buttonBg}
        accessibilityLabel="Notifications"
        onPress={onNotifications}
      />
    </Stack.Toolbar>
  );
});

function ActionButton({
  icon,
  label,
  onPress
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 basis-0 min-w-0 justify-start"
    >
      {({ pressed }) => (
        <VStack className="items-center gap-y-2 px-1">
          <Box
            className={cn(
              pressed ? "bg-primary-600" : "bg-primary-500",
              "h-14 w-14 items-center justify-center rounded-full"
            )}
          >
            {icon}
          </Box>

          <Text className="text-white text-sm font-medium text-center leading-tight">
            {label}
          </Text>
        </VStack>
      )}
    </Pressable>
  );
}

const FriendCard = React.memo(function FriendCard({
  item,
  router
}: {
  item: FriendSummary;
  router: ReturnType<typeof useRouter>;
}) {
  const { friend, balances } = item;
  const [primary] = balances;
  const isNegative = (primary?.amount ?? 0) < 0;
  const name = `${friend.first_name} ${friend.last_name}`;

  const handlePress = useCallback(() => {
    router.push({
      pathname: "/friends/[friendId]",
      params: {
        friendId: friend.id,
        name,
        email: friend.email,
        avatar: friend.avatar || ""
      }
    });
  }, [friend.id, friend.email, friend.avatar, name, router]);

  return (
    <Pressable onPress={handlePress}>
      {({ pressed }) => (
        <Box
          className={cn(
            pressed ? "bg-secondary-100" : "bg-secondary-50",
            "min-w-40 border border-secondary-500 rounded-lg p-4"
          )}
        >
          <VStack className="gap-y-2">
            <AppAvatar name={name} uri={friend.avatar || undefined} size="sm" />
            <VStack>
              <Text className="text-lg" numberOfLines={2}>
                {name}
              </Text>
              {primary && (
                <Text
                  className={cn(
                    "text-lg",
                    isNegative ? "text-error-400" : undefined
                  )}
                  numberOfLines={1}
                >
                  {isNegative ? "-" : ""}
                  {formatAmount(Math.abs(primary.amount), primary.currency)}
                </Text>
              )}
            </VStack>
          </VStack>
        </Box>
      )}
    </Pressable>
  );
});

function StatItem({
  type,
  items,
  isLoading,
  primaryCurrency
}: {
  type: "RECEIVE" | "PAY";
  items: { currency: string; amount: number }[];
  isLoading: boolean;
  primaryCurrency?: string;
}) {
  const isReceive = type === "RECEIVE";
  const label = isReceive ? "To Collect" : "To Pay";

  const sorted = useMemo(
    () =>
      [...items].sort((a, b) =>
        a.currency === primaryCurrency
          ? -1
          : b.currency === primaryCurrency
            ? 1
            : 0
      ),
    [items, primaryCurrency]
  );
  const [primary] = sorted;
  const primaryAmount = primary?.amount ?? 0;

  return (
    <VStack className="flex-1 gap-y-2">
      <HStack className="items-center gap-x-2">
        <SettlementAvatar isPayer={isReceive} light />
        <Text className="text-white">{label}</Text>
      </HStack>
      {isLoading ? (
        <Text bold className="text-2xl text-white">
          —
        </Text>
      ) : (
        <HStack className="items-center gap-x-2">
          <Text bold className="text-2xl text-white">
            {formatAmount(primaryAmount, primary?.currency ?? primaryCurrency)}
          </Text>
          <CurrencyCountButton
            items={sorted}
            title={label}
            subtitle="Breakdown by currency"
          />
        </HStack>
      )}
    </VStack>
  );
}

function NetBalanceRow({
  items,
  isLoading,
  primaryCurrency = "PHP"
}: {
  items: { currency: string; amount: number }[];
  isLoading: boolean;
  primaryCurrency?: string;
}) {
  const sorted = useMemo(
    () =>
      [...items].sort((a, b) =>
        a.currency === primaryCurrency
          ? -1
          : b.currency === primaryCurrency
            ? 1
            : 0
      ),
    [items, primaryCurrency]
  );
  const [primary] = sorted;
  const primaryAmount = primary?.amount ?? 0;

  return (
    <VStack className="gap-y-2">
      <Text bold className="text-sm text-white uppercase">
        Net Balance
      </Text>
      {isLoading ? (
        <Text bold className="text-4xl text-white">
          —
        </Text>
      ) : (
        <HStack className="items-end gap-x-2">
          <Text bold className="text-4xl text-white">
            {formatAmount(primaryAmount, primary?.currency ?? primaryCurrency)}
          </Text>
          <HStack className="items-center gap-x-1 pb-1">
            <Text className="text-white/70 text-base">
              {primary?.currency ?? primaryCurrency}
            </Text>
            <CurrencyCountButton
              items={sorted}
              title="Net Balance"
              subtitle="To Collect minus To Pay, per currency"
            />
          </HStack>
        </HStack>
      )}
    </VStack>
  );
}
