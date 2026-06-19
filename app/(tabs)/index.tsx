import AppAvatar from "@/components/AppAvatar";
import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import ListDivider from "@/components/ListDivider";
import LoadingWrapper from "@/components/LoadingWrapper";
import PressableListItem from "@/components/PressableListItem";
import {
  FriendCardListSkeleton,
  GroupListSkeleton,
  SettlementListSkeleton
} from "@/components/SkeletonLoader";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { KeyboardAvoidingView } from "@/components/ui/keyboard-avoiding-view";
import { Pressable } from "@/components/ui/pressable";
import {
  ScrollView as HScrollView,
  ScrollView
} from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import NewExpensePickerSheet from "@/features/expense/components/NewExpensePickerSheet";
import QuickAddExpenseSheet from "@/features/expense/components/QuickAddExpenseSheet";
import SettlementActionSheet from "@/features/expense/components/SettlementActionSheet";
import SettlementAvatar from "@/features/expense/components/SettlementAvatar";
import SettlementItem from "@/features/expense/components/SettlementItem";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import GroupItem from "@/features/group/components/GroupItem";
import services from "@/services";
import states from "@/states";
import { FriendSummary, PaymentPreview } from "@/types/expenses";
import { EmptyType } from "@/types/general";
import { cacheService } from "@/utils/cacheService";
import { getSecondaryHex } from "@/utils/getColorHex";
import { addRecentUsers } from "@/utils/recentUsers";
import { getReminderEnabled } from "@/utils/reminderPreference";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import * as Notifications from "expo-notifications";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Bell,
  CircleQuestionMark,
  HousePlus,
  PlusCircle
} from "lucide-react-native";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Animated, RefreshControl, useColorScheme } from "react-native";

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
  const [newExpensePickerOpen, setNewExpensePickerOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const { details: userDetails, session, defaultCurrency } = states.user();
  // Use session.user.id as fallback — it's available immediately after login
  // without waiting for fetchDetails to complete
  const userId = userDetails?.id ?? session?.user?.id;
  const { list: groupList } = states.group();
  const { activityList } = states.expense();
  const { unreadCount } = states.notification();

  const netBalance = useMemo(() => {
    const allCurrencies = new Set([
      ...stats.toReceive.map((i) => i.currency),
      ...stats.toPay.map((i) => i.currency)
    ]);
    return Array.from(allCurrencies).map((currency) => {
      const receive =
        stats.toReceive.find((i) => i.currency === currency)?.amount ?? 0;
      const pay = stats.toPay.find((i) => i.currency === currency)?.amount ?? 0;
      return { currency, amount: receive - pay };
    });
  }, [stats.toReceive, stats.toPay]);

  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";

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
    const sorted = [...stats.toReceive].sort((a, b) =>
      a.currency === defaultCurrency
        ? -1
        : b.currency === defaultCurrency
          ? 1
          : 0
    );
    return sorted[0] ?? { currency: defaultCurrency, amount: 0 };
  }, [stats.toReceive, defaultCurrency]);

  const primaryPay = useMemo(() => {
    const sorted = [...stats.toPay].sort((a, b) =>
      a.currency === defaultCurrency
        ? -1
        : b.currency === defaultCurrency
          ? 1
          : 0
    );
    return sorted[0] ?? { currency: defaultCurrency, amount: 0 };
  }, [stats.toPay, defaultCurrency]);

  const COMPACT_THRESHOLD = 180;
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

  useEffect(() => {
    if (!userId) {
      setInitialized(false);
      return;
    }
    setInitialized(false);
    init(false);
  }, [userId]);

  useFocusEffect(
    useMemo(
      () => () => {
        if (!userId) return;
        init(initialized);
      },
      [userId, initialized]
    )
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

      setStats({
        toPay: response.toPay,
        toReceive: response.toReceive
      });
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

      cacheService.savePayments(userId, response.data).catch(() => {});

      states.expense.setState((prev) => ({
        ...prev,
        activityList: response.data
      }));
    } catch (error) {
      console.error("Failed to fetch recent expenses:", error);
      const cached = await cacheService.getPayments(userId);
      if (cached)
        states.expense.setState((prev) => ({
          ...prev,
          activityList: cached
        }));
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

      cacheService.saveGroupsList(userId, response).catch(() => {});

      states.group.setState((prev) => ({
        ...prev,
        list: response
      }));
    } catch (error) {
      console.error("Failed to fetch groups:", error);
      const cached = await cacheService.getGroupsList(userId);
      if (cached) states.group.setState((prev) => ({ ...prev, list: cached }));
    } finally {
      setLoading((prev) => ({ ...prev, groups: false }));
    }
  };

  const fetchFriends = async (isInitialized = false) => {
    if (!userId) return;
    if (!isInitialized) setLoading((prev) => ({ ...prev, friends: true }));
    try {
      const data = await services.friend.getFriendsSummary(userId);
      cacheService.saveFriends(userId, data).catch(() => {});
      setFriends(data);
      addRecentUsers(
        data.map((f) => f.friend),
        userId
      ).catch(() => {});
    } catch (error) {
      console.error("Failed to fetch friends:", error);
      const cached = await cacheService.getFriends(userId);
      if (cached) setFriends(cached);
    } finally {
      setLoading((prev) => ({ ...prev, friends: false }));
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await init(true);
    setRefreshing(false);
  };

  const groupsPreview = useMemo(() => {
    return groupList.slice(0, 5);
  }, [groupList]);

  const activitiesPreview = useMemo(() => {
    return activityList.slice(0, 5);
  }, [activityList]);

  return (
    <Fragment>
      <KeyboardAvoidingView
        className="flex-1 bg-secondary-0"
        behavior="padding"
      >
        <Box className="sticky top-0 bg-primary-400">
          <HStack className="items-center justify-center px-4 pt-[5rem] pb-2">
            <VStack className="flex-1">
              <Text className="text-background-0/70">Hello,</Text>
              <Text bold className="text-xl text-background-0">
                {userDetails?.first_name} {userDetails?.last_name}
              </Text>
            </VStack>
            <HStack className="gap-x-6">
              <Button
                variant="link"
                className="rounded-full"
                onPress={() => router.push("/profile/help-center")}
              >
                <CircleQuestionMark
                  color={getSecondaryHex("text-secondary-0", colorScheme)}
                />
              </Button>
              <Button
                variant="link"
                className="rounded-full"
                onPress={() => router.push("/notifications")}
              >
                <Box className="relative">
                  <Bell
                    color={getSecondaryHex("text-secondary-0", colorScheme)}
                  />
                  {unreadCount > 0 && (
                    <Box className="absolute -top-1 -right-1 bg-error-400 rounded-full flex w-4 h-4 items-center justify-center">
                      <Text className="text-white text-2xs font-semibold">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </Text>
                    </Box>
                  )}
                </Box>
              </Button>
            </HStack>
          </HStack>

          {/* Compact sticky stats — fades in as card scrolls out */}
          <Animated.View
            style={{
              height: compactHeight,
              opacity: compactOpacity,
              overflow: "hidden",
              transform: [{ translateY: compactTranslateY }]
            }}
          >
            <HStack className="px-6 pt-2 gap-x-4 items-center justify-center">
              <VStack className="items-center flex-1">
                <Text className="text-background-0/70 text-sm uppercase tracking-widest">
                  Net
                </Text>
                <Text bold className="text-background-0 text-lg">
                  {formatAmount(primaryNet.amount, primaryNet.currency)}
                </Text>
              </VStack>
              <Text className="text-white/20">|</Text>
              <VStack className="items-center flex-1">
                <Text className="text-background-0/70 text-sm uppercase tracking-widest">
                  Collect
                </Text>
                <Text bold className="text-background-0 text-lg">
                  {formatAmount(primaryReceive.amount, primaryReceive.currency)}
                </Text>
              </VStack>
              <Text className="text-white/20">|</Text>
              <VStack className="items-center flex-1">
                <Text className="text-background-0/70 text-sm uppercase tracking-widest">
                  Pay
                </Text>
                <Text bold className="text-background-0 text-lg">
                  {formatAmount(primaryPay.amount, primaryPay.currency)}
                </Text>
              </VStack>
            </HStack>
          </Animated.View>
        </Box>
        <ScrollView
          className="flex-1 bg-primary-400"
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
                      items={stats.toReceive}
                      primaryCurrency={defaultCurrency}
                    />
                    <Divider
                      orientation="vertical"
                      className="mx-4 bg-white/20"
                    />
                    <StatItem
                      type="PAY"
                      isLoading={loading.stats}
                      items={stats.toPay}
                      primaryCurrency={defaultCurrency}
                    />
                  </HStack>
                </VStack>

                {/* Action Buttons */}
                <HStack className="gap-x-2">
                  <FormButton
                    className="flex-1"
                    icon={
                      <PlusCircle
                        size={18}
                        color={getSecondaryHex("text-secondary-0", colorScheme)}
                      />
                    }
                    text="New Expense"
                    onPress={() => setNewExpensePickerOpen(true)}
                  />
                  <FormButton
                    className="flex-1"
                    text="Create Group"
                    icon={
                      <HousePlus
                        size={18}
                        color={getSecondaryHex("text-secondary-0", colorScheme)}
                      />
                    }
                    onPress={() => router.push("/groups/create")}
                  />
                </HStack>
              </VStack>
            </Box>

            <VStack>
              <HStack className="items-center justify-between px-4">
                <Text bold className="text-2xl flex-1">
                  Friends
                </Text>
                <FormButton
                  text="View All"
                  variant="link"
                  onPress={() => router.push("/friends")}
                />
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
                      {friends.slice(0, 5).map((item) => (
                        <FriendCard
                          key={item.friend.id}
                          item={item}
                          onPress={() =>
                            router.push({
                              pathname: "/friends/[friendId]",
                              params: {
                                friendId: item.friend.id,
                                name: `${item.friend.first_name} ${item.friend.last_name}`,
                                email: item.friend.email,
                                avatar: item.friend.avatar || ""
                              }
                            })
                          }
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
                  data={activitiesPreview}
                  scrollEnabled={false}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={({ item }) => (
                    <SettlementItem
                      item={item}
                      onPress={() => {
                        setSelectedPayment(item);
                        setActionSheetOpen(true);
                      }}
                    />
                  )}
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
                <FormButton
                  text="View All"
                  variant="link"
                  onPress={() => router.push("/groups")}
                />
              </HStack>
              <LoadingWrapper
                isLoading={loading.groups}
                skeleton={<GroupListSkeleton count={3} />}
              >
                <FlatList
                  data={groupsPreview}
                  scrollEnabled={false}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={({ item }) => (
                    <GroupItem
                      details={item}
                      onOpen={() => router.push(`/groups/${item.id}`)}
                    />
                  )}
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
      </KeyboardAvoidingView>
      <SettlementActionSheet
        isOpen={actionSheetOpen}
        onClose={() => setActionSheetOpen(false)}
        item={selectedPayment}
        onRefetch={() => init(true)}
      />
      <NewExpensePickerSheet
        isOpen={newExpensePickerOpen}
        onClose={() => setNewExpensePickerOpen(false)}
        onQuickAdd={() => setQuickAddOpen(true)}
        onCustom={() => {
          setNewExpensePickerOpen(false);
          router.push("/groups/[groupId]/new-expense");
        }}
      />
      <QuickAddExpenseSheet
        isOpen={quickAddOpen}
        group={groupList[0] ?? null}
        allowGroupChange
        onClose={() => setQuickAddOpen(false)}
        onSuccess={() => {
          init(true);
          states.group.setState((prev) => ({
            ...prev,
            settlementRefreshToken: prev.settlementRefreshToken + 1
          }));
        }}
      />
    </Fragment>
  );
}

function FriendCard({
  item,
  onPress
}: {
  item: FriendSummary;
  onPress: () => void;
}) {
  const { friend, balances } = item;
  const [primary] = balances;
  const isNegative = (primary?.amount ?? 0) < 0;
  const name = `${friend.first_name} ${friend.last_name}`;

  return (
    <PressableListItem
      onPress={onPress}
      className="border min-w-40 border-secondary-500 rounded-lg p-4"
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
    </PressableListItem>
  );
}

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
  const [sheetOpen, setSheetOpen] = useState(false);
  const isReceive = type === "RECEIVE";
  const label = isReceive ? "To Collect" : "To Pay";

  const sorted = [...items].sort((a, b) =>
    a.currency === primaryCurrency ? -1 : b.currency === primaryCurrency ? 1 : 0
  );
  const [primary, ...secondary] = sorted;
  const primaryAmount = primary?.amount ?? 0;

  return (
    <Fragment>
      <VStack className="flex-1 gap-y-2">
        <HStack className="items-center gap-x-2">
          <SettlementAvatar isPayer={isReceive} light />
          <Text className="text-background-0">{label}</Text>
        </HStack>
        {isLoading ? (
          <Text bold className="text-2xl text-background-0">
            —
          </Text>
        ) : (
          <Pressable
            onPress={
              secondary.length > 0 ? () => setSheetOpen(true) : undefined
            }
          >
            <HStack className="items-center gap-x-2">
              <Text bold className="text-2xl text-background-0">
                {formatAmount(
                  primaryAmount,
                  primary?.currency ?? primaryCurrency
                )}
              </Text>
              {secondary.length > 0 && (
                <Box className="bg-white/20 rounded-full h-5 w-5 items-center justify-center">
                  <Text className="text-background-0 text-xs font-semibold">
                    +{secondary.length}
                  </Text>
                </Box>
              )}
            </HStack>
          </Pressable>
        )}
      </VStack>

      <Actionsheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)}>
        <ActionsheetBackdrop />
        <ActionsheetContent className="p-0">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <VStack className="w-full">
            <VStack className="p-4">
              <Text bold className="text-xl">
                {label}
              </Text>
              <Text className="text-secondary-950">Breakdown by currency</Text>
            </VStack>
            <FlatList
              data={sorted}
              scrollEnabled={false}
              keyExtractor={(item) => item.currency}
              renderItem={({ item: { currency, amount } }) => (
                <HStack className="items-center justify-between p-4">
                  <Text className="text-secondary-950 font-medium text-lg">
                    {currency}
                  </Text>
                  <Text bold className="text-lg">
                    {formatAmount(amount, currency)}
                  </Text>
                </HStack>
              )}
              ItemSeparatorComponent={ListDivider}
            />
          </VStack>
        </ActionsheetContent>
      </Actionsheet>
    </Fragment>
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
  const [sheetOpen, setSheetOpen] = useState(false);

  const sorted = [...items].sort((a, b) =>
    a.currency === primaryCurrency ? -1 : b.currency === primaryCurrency ? 1 : 0
  );
  const [primary, ...secondary] = sorted;
  const primaryAmount = primary?.amount ?? 0;

  return (
    <Fragment>
      <VStack className="gap-y-2">
        <Text bold className="text-background-0 uppercase text-sm">
          Net Balance
        </Text>
        {isLoading ? (
          <Text bold className="text-4xl text-background-0">
            —
          </Text>
        ) : (
          <Pressable
            onPress={
              secondary.length > 0 ? () => setSheetOpen(true) : undefined
            }
          >
            <HStack className="items-end gap-x-2">
              <Text bold className="text-4xl text-background-0">
                {formatAmount(
                  primaryAmount,
                  primary?.currency ?? primaryCurrency
                )}
              </Text>
              <HStack className="items-center gap-x-1 pb-1">
                <Text className="text-background-0/70 text-base">
                  {primary?.currency ?? primaryCurrency}
                </Text>
                {secondary.length > 0 && (
                  <Box className="bg-white/20 rounded-full h-5 w-5 items-center justify-center">
                    <Text className="text-background-0 text-xs font-semibold">
                      +{secondary.length}
                    </Text>
                  </Box>
                )}
              </HStack>
            </HStack>
          </Pressable>
        )}
      </VStack>

      <Actionsheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)}>
        <ActionsheetBackdrop />
        <ActionsheetContent className="p-0">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <VStack className="w-full">
            <VStack className="p-4">
              <Text bold className="text-xl">
                Net Balance
              </Text>
              <Text className="text-secondary-950">
                To Collect minus To Pay, per currency
              </Text>
            </VStack>
            <FlatList
              data={sorted}
              scrollEnabled={false}
              keyExtractor={(item) => item.currency}
              renderItem={({ item: { currency, amount } }) => {
                const color =
                  amount > 0
                    ? "text-success-400"
                    : amount < 0
                      ? "text-error-400"
                      : "text-secondary-950";
                return (
                  <HStack className="items-center justify-between p-4">
                    <Text className="text-secondary-950 font-medium text-lg">
                      {currency}
                    </Text>
                    <Text bold className={cn("text-lg", color)}>
                      {amount > 0 ? "+" : ""}
                      {formatAmount(amount, currency)}
                    </Text>
                  </HStack>
                );
              }}
              ItemSeparatorComponent={ListDivider}
            />
          </VStack>
        </ActionsheetContent>
      </Actionsheet>
    </Fragment>
  );
}
