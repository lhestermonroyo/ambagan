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
import BookItem from "@/features/book/components/BookItem";
import PersonalExpenseItem from "@/features/book/components/PersonalExpenseItem";
import PersonalSpendingCard from "@/features/book/components/PersonalSpendingCard";
import ExpenseDestinationSheet from "@/features/expense/components/ExpenseDestinationSheet";
import NetBalanceDisplay from "@/features/expense/components/NetBalanceDisplay";
import SettlementActionSheet from "@/features/expense/components/SettlementActionSheet";
import SettlementAvatar from "@/features/expense/components/SettlementAvatar";
import SettlementItem from "@/features/expense/components/SettlementItem";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import GroupItem from "@/features/group/components/GroupItem";
import { useEnsureOnline } from "@/hooks/useEnsureOnline";
import services from "@/services";
import states from "@/states";
import { Book, PersonalExpense, PersonalOverview } from "@/types/books";
import { FriendSummary, PaymentPreview } from "@/types/expenses";
import { EmptyType } from "@/types/general";
import { BASE_CURRENCY, useConvertedTotal } from "@/utils/fx";
import { getPrimaryHex } from "@/utils/getColorHex";
import { prefetchGroupDetails } from "@/utils/offlinePrefetch";
import { addRecentUsers } from "@/utils/recentUsers";
import { getReminderEnabled } from "@/utils/reminderPreference";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import * as Notifications from "expo-notifications";
import { Stack, useFocusEffect, useIsFocused, useRouter } from "expo-router";
import {
  Bell,
  BellDot,
  CircleQuestionMark,
  HousePlus,
  ListPlus,
  QrCode,
  ScanLine
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
    books: false,
    friends: false,
    personal: false
  });
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [personalExpenses, setPersonalExpenses] = useState<PersonalExpense[]>(
    []
  );
  const [personalOverview, setPersonalOverview] =
    useState<PersonalOverview | null>(null);
  const [addChooserOpen, setAddChooserOpen] = useState(false);
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

  const { details: userDetails, session, settlementView } = states.user();
  // Use session.user.id as fallback — it's available immediately after login
  // without waiting for fetchDetails to complete
  const userId = userDetails?.id ?? session?.user?.id;
  const { list: groupList } = states.group();
  const { activityList } = states.expense();
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
  const ensureOnline = useEnsureOnline();
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

  // The compact bar mirrors the hero, so all three figures convert on the same
  // terms — the two are on screen together mid-scroll, and a bar that disagreed
  // with the card it fades in from would read as a bug. It has no chip of its
  // own; the hero a scroll away is where the working lives.
  const compactNet = useConvertedTotal(netBalance, BASE_CURRENCY);
  const compactReceive = useConvertedTotal(
    displayStats.toReceive,
    BASE_CURRENCY
  );
  const compactPay = useConvertedTotal(displayStats.toPay, BASE_CURRENCY);

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
      fetchBooks(isInitialized),
      fetchActivities(isInitialized),
      fetchFriends(isInitialized),
      fetchPersonal(isInitialized),
      fetchUnreadCount()
    ]).then(() => {
      setInitialized(true);
    });
  };

  const fetchPersonal = async (isInitialized = false) => {
    if (!userId) return;

    if (!isInitialized) {
      setLoading((prev) => ({ ...prev, personal: true }));
    }

    try {
      const overview = await services.bookExpense.getPersonalOverview(userId);
      setPersonalOverview(overview);
    } catch (error) {
      console.error("Failed to fetch personal spending:", error);
    } finally {
      setLoading((prev) => ({ ...prev, personal: false }));
    }
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

    // The two recent-activity sections share one loading flag, so they're
    // fetched side by side — and caught independently, so a failure on one side
    // (e.g. personal expenses offline) still fills the other.
    await Promise.all([
      (async () => {
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
        }
      })(),
      (async () => {
        try {
          const recent = await services.bookExpense.getRecentPersonalExpenses(
            userId,
            3
          );
          setPersonalExpenses(recent);
        } catch (error) {
          console.error("Failed to fetch recent personal expenses:", error);
        }
      })()
    ]);

    setLoading((prev) => ({ ...prev, activities: false }));
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

  // Only the first page is needed — the Overview shows the 3 most recent books
  // and hands off to the Books tab for the rest. Paginated (not getBooksByUserId)
  // so the offline cache fallback comes along for free.
  const fetchBooks = async (isInitialized = false) => {
    if (!userId) return;

    if (!isInitialized) {
      setLoading((prev) => ({ ...prev, books: true }));
    }

    try {
      const response = await services.book.getBooksByUserIdPaginated(
        userId,
        0,
        "all"
      );

      if (!response) return;

      setBooks(response.data);
    } catch (error) {
      console.error("Failed to fetch books:", error);
    } finally {
      setLoading((prev) => ({ ...prev, books: false }));
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

  const groupsPreview = useMemo(() => groupList.slice(0, 3), [groupList]);
  const booksPreview = useMemo(() => books.slice(0, 3), [books]);
  const friendsPreview = useMemo(() => friends.slice(0, 5), [friends]);

  // The two ledgers stay in their own sections — a settlement and a personal
  // expense read too differently to sit in one list.
  const settlementsPreview = useMemo(
    () => activityList.slice(0, 3),
    [activityList]
  );
  const personalExpensesPreview = useMemo(
    () => personalExpenses.slice(0, 3),
    [personalExpenses]
  );

  const handleOpenActionSheet = useCallback((item: PaymentPreview) => {
    setSelectedPayment(item);
    setActionSheetOpen(true);
  }, []);

  const handleCloseActionSheet = useCallback(
    () => setActionSheetOpen(false),
    []
  );
  const handleRefetch = useCallback(() => init(true), [userId]);

  // Groups and personal books both have an Add Expense flow, so the Overview
  // button asks which one first (see ExpenseDestinationSheet). Each destination
  // is reached via its literal "[groupId]" / "[bookId]" segment, so the form
  // defaults the group/book (most recent, changeable) rather than locking one.
  const handleOpenAddExpense = useCallback(() => setAddChooserOpen(true), []);
  const handleAddGroupExpense = useCallback(() => {
    setAddChooserOpen(false);
    router.push("/groups/[groupId]/add-expense");
  }, [router]);
  const handleAddPersonalExpense = useCallback(() => {
    setAddChooserOpen(false);
    router.push("/books/[bookId]/add-expense");
  }, [router]);

  const handleOpenScan = useCallback(async () => {
    if (
      !(await ensureOnline(
        "You need an internet connection to scan a receipt. Please try again when you're back online."
      ))
    ) {
      return;
    }
    router.push("/scan-receipt" as any);
  }, [ensureOnline, router]);

  const handleScanToJoin = useCallback(async () => {
    if (
      !(await ensureOnline(
        "You need an internet connection to scan and join a group. Please try again when you're back online."
      ))
    ) {
      return;
    }
    router.push("/scan" as any);
  }, [ensureOnline, router]);

  const handleOpenBooks = useCallback(() => router.push("/books"), [router]);
  const handleOpenHelp = useCallback(
    () => router.push("/profile/help-center"),
    [router]
  );
  const handleOpenNotifications = useCallback(
    () => router.push("/notifications"),
    [router]
  );

  const renderSettlementItem = useCallback(
    ({ item }: { item: PaymentPreview }) => (
      <SettlementItem item={item} onPress={() => handleOpenActionSheet(item)} />
    ),
    [handleOpenActionSheet]
  );

  const renderPersonalExpenseItem = useCallback(
    ({ item }: { item: PersonalExpense }) => (
      <PersonalExpenseItem
        details={item}
        onOpen={() =>
          router.push(`/books/${item.book_id}/add-expense?expenseId=${item.id}`)
        }
      />
    ),
    [router]
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

  const renderBookItem = useCallback(
    ({ item }: { item: Book }) => (
      <BookItem
        details={item}
        onOpen={() => router.push(`/books/${item.id}`)}
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
                  <HStack className="items-center gap-x-8 pr-1">
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
                        {unreadCount > 0 ? (
                          <BellDot color={tintColor} />
                        ) : (
                          <Bell color={tintColor} />
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
              <VStack className="p-4 pt-6 gap-y-6">
                <VStack className="gap-y-4">
                  {/* Net Balance Hero */}
                  <NetBalanceDisplay
                    isLoading={loading.stats}
                    items={netBalance}
                    currency={BASE_CURRENCY}
                    tone="onColor"
                    size="lg"
                    subtitle="To Collect minus To Pay, per currency, across all groups"
                  />

                  <Divider className="bg-white/20" />

                  {/* Stat Columns */}
                  <HStack className="items-stretch">
                    <StatItem
                      type="RECEIVE"
                      isLoading={loading.stats}
                      items={displayStats.toReceive}
                      primaryCurrency={BASE_CURRENCY}
                    />
                    <Divider
                      orientation="vertical"
                      className="mx-4 bg-white/20"
                    />
                    <StatItem
                      type="PAY"
                      isLoading={loading.stats}
                      items={displayStats.toPay}
                      primaryCurrency={BASE_CURRENCY}
                    />
                  </HStack>
                </VStack>

                {/* Action Buttons stay live for instant entry — the expense
                  flows below handle the still-loading case by skeletoning
                  their own group / payer fields rather than blocking here. */}
                <HStack className="gap-x-2 justify-center">
                  <ActionButton
                    icon={<ListPlus size={24} color="#fff" />}
                    label={`Add\n\Expense`}
                    onPress={handleOpenAddExpense}
                  />
                  <ActionButton
                    icon={<ScanLine size={24} color="#fff" />}
                    label={`Scan\n\Receipt`}
                    onPress={handleOpenScan}
                  />
                  <ActionButton
                    icon={<HousePlus size={24} color="#fff" />}
                    label={`Create\n\Group`}
                    onPress={() => router.push("/groups/create")}
                  />
                  <ActionButton
                    icon={<QrCode size={24} color="#fff" />}
                    label={`Scan to\n\Join`}
                    onPress={handleScanToJoin}
                  />
                </HStack>
              </VStack>
            </Box>

            {/* Personal spending — a distinct card in the white body (kept out of
              the purple net-balance hero so it never reads as money owed). Taps
              through to the Books tab. */}
            <PersonalSpendingCard
              overview={personalOverview}
              isLoading={loading.personal}
              onPress={handleOpenBooks}
            />

            <VStack className="gap-y-2">
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

            <VStack className="gap-y-2">
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

            <VStack className="gap-y-2">
              <HStack className="items-center justify-between px-4">
                <Text bold className="text-2xl">
                  Recent Books
                </Text>
                <Button variant="link" onPress={() => router.push("/books")}>
                  <Text className="text-primary-400 font-medium">View All</Text>
                </Button>
              </HStack>
              <LoadingWrapper
                isLoading={loading.books}
                skeleton={<GroupListSkeleton count={3} />}
              >
                <FlatList
                  data={booksPreview}
                  scrollEnabled={false}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={renderBookItem}
                  ItemSeparatorComponent={ListDivider}
                  ListEmptyComponent={() => <EmptyList type={EmptyType.BOOK} />}
                />
              </LoadingWrapper>
            </VStack>

            <VStack className="gap-y-2">
              <HStack className="items-center justify-between px-4">
                <Text bold className="text-2xl">
                  Recent Settlements
                </Text>
              </HStack>
              <LoadingWrapper
                isLoading={loading.activities}
                skeleton={<SettlementListSkeleton count={3} />}
              >
                <FlatList
                  key={settlementView}
                  data={settlementsPreview}
                  extraData={settlementView}
                  scrollEnabled={false}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={renderSettlementItem}
                  ItemSeparatorComponent={ListDivider}
                  ListEmptyComponent={() => (
                    <EmptyList type={EmptyType.ACTIVITY} />
                  )}
                />
              </LoadingWrapper>
            </VStack>

            <VStack className="gap-y-2">
              <HStack className="items-center justify-between px-4">
                <Text bold className="text-2xl">
                  Recent Personal Expenses
                </Text>
              </HStack>
              <LoadingWrapper
                isLoading={loading.activities}
                skeleton={<SettlementListSkeleton count={3} />}
              >
                <FlatList
                  data={personalExpensesPreview}
                  scrollEnabled={false}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={renderPersonalExpenseItem}
                  ItemSeparatorComponent={ListDivider}
                  ListEmptyComponent={() => (
                    <EmptyList type={EmptyType.EXPENSE} />
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
              <Text
                className="text-white/70 text-sm uppercase tracking-widest"
                numberOfLines={1}
              >
                Net
              </Text>
              <Text bold className="text-white text-lg">
                {compactNet.convertedCurrencies.length > 0 ? "≈ " : ""}
                {formatAmount(compactNet.total, BASE_CURRENCY)}
              </Text>
            </VStack>
            <Text className="text-white/20">|</Text>
            <VStack className="items-center flex-1">
              <Text
                className="text-white/70 text-sm uppercase tracking-widest"
                numberOfLines={1}
              >
                Collect
              </Text>
              <Text bold className="text-white text-lg" numberOfLines={1}>
                {compactReceive.convertedCurrencies.length > 0 ? "≈ " : ""}
                {formatAmount(compactReceive.total, BASE_CURRENCY)}
              </Text>
            </VStack>
            <Text className="text-white/20">|</Text>
            <VStack className="items-center flex-1">
              <Text
                className="text-white/70 text-sm uppercase tracking-widest"
                numberOfLines={1}
              >
                Pay
              </Text>
              <Text bold className="text-white text-lg" numberOfLines={1}>
                {compactPay.convertedCurrencies.length > 0 ? "≈ " : ""}
                {formatAmount(compactPay.total, BASE_CURRENCY)}
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

      <ExpenseDestinationSheet
        isOpen={addChooserOpen}
        onClose={() => setAddChooserOpen(false)}
        onSelectGroup={handleAddGroupExpense}
        onSelectPersonal={handleAddPersonalExpense}
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
            "w-48 border border-secondary-500 rounded-lg p-4"
          )}
        >
          <VStack className="gap-y-2">
            <AppAvatar name={name} uri={friend.avatar || undefined} size="sm" />
            <VStack>
              <Text className="text-lg" numberOfLines={1}>
                {name}
              </Text>
              {primary && (
                <Text
                  className={cn(
                    "text-lg font-medium",
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
  // Defaulted rather than optional at the point of use: an undefined target
  // makes useConvertedTotal return zero, which would read as "you're square".
  primaryCurrency = "PHP"
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

  // Folded to one figure like the net balance above it: a stat that showed only
  // its peso slice while the chip hid the yen read as the whole answer. The
  // exact per-currency working is one tap behind the chip, and each settlement
  // row below still stands in the currency it will be paid in.
  const { total, convertedCurrencies } = useConvertedTotal(
    items,
    primaryCurrency
  );
  const amountText = `${convertedCurrencies.length > 0 ? "≈ " : ""}${formatAmount(total, primaryCurrency)}`;

  return (
    <VStack className="flex-1 gap-y-2">
      <HStack className="items-center gap-x-2">
        <SettlementAvatar size="sm" isPayer={isReceive} light />
        <Text className="text-white text-sm uppercase">{label}</Text>
      </HStack>
      {isLoading ? (
        <Text bold className="text-2xl text-white">
          —
        </Text>
      ) : (
        <HStack className="items-center gap-x-2">
          <Text
            bold
            className={cn("text-white flex-shrink text-xl")}
            numberOfLines={1}
          >
            {amountText}
          </Text>
          <CurrencyCountButton
            items={sorted}
            title={label}
            subtitle={
              isReceive
                ? "Owed to you across all groups, per currency"
                : "You owe across all groups, per currency"
            }
            convertTo={primaryCurrency}
            totalLabel={isReceive ? "Total to collect" : "Total to pay"}
          />
        </HStack>
      )}
    </VStack>
  );
}
