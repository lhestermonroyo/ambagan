import AppAvatar from "@/components/AppAvatar";
import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import LoadingWrapper from "@/components/LoadingWrapper";
import {
  FriendCardListSkeleton,
  GroupListSkeleton,
  SettlementListSkeleton
} from "@/components/SkeletonLoader";
import PressableListItem from "@/components/PressableListItem";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { KeyboardAvoidingView } from "@/components/ui/keyboard-avoiding-view";
import {
  ScrollView as HScrollView,
  ScrollView
} from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import CurrencyAmountDisplay from "@/features/expense/components/CurrencyAmountDisplay";
import NewExpensePickerSheet from "@/features/expense/components/NewExpensePickerSheet";
import QuickAddExpenseSheet from "@/features/expense/components/QuickAddExpenseSheet";
import SettlementActionSheet from "@/features/expense/components/SettlementActionSheet";
import SettlementAvatar from "@/features/expense/components/SettlementAvatar";
import SettlementItem from "@/features/expense/components/SettlementItem";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import GroupItem from "@/features/group/components/GroupItem";
import services from "@/services";
import states from "@/states";
import { cacheService } from "@/utils/cacheService";
import { FriendSummary, PaymentPreview } from "@/types/expenses";
import { EmptyType } from "@/types/general";
import { getSecondaryHex } from "@/utils/getColorHex";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Bell,
  CircleQuestionMark,
  HousePlus,
  PlusCircle
} from "lucide-react-native";
import { Fragment, useMemo, useState } from "react";
import { RefreshControl, useColorScheme } from "react-native";
import ListDivider from "@/components/ListDivider";

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

  const { details: userDetails, defaultCurrency } = states.user();
  const { list: groupList } = states.group();
  const { activityList } = states.expense();
  const { unreadCount } = states.notification();

  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";

  useFocusEffect(
    useMemo(
      () => () => {
        if (!userDetails?.id) return;

        init(initialized);
      },
      [userDetails?.id, initialized]
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
    if (!userDetails?.id) return;
    try {
      const count = await services.notification.getUnreadCount(userDetails.id);
      states.notification.setState((prev) => ({ ...prev, unreadCount: count }));
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    }
  };

  const fetchStats = async (isInitialized = false) => {
    if (!userDetails?.id) return;

    if (!isInitialized) {
      setLoading((prev) => ({ ...prev, stats: true }));
    }

    try {
      const response = await services.expense.getStatsByUserId(userDetails.id);

      if (!response) return;

      setStats({
        toPay: response.toPay,
        toReceive: response.toReceive
      });
    } catch (error) {
      console.error("Failed to fetch expense statistics:", error);
    } finally {
      setLoading((prev) => ({ ...prev, stats: false }));
    }
  };

  const fetchActivities = async (isInitialized = false) => {
    if (!userDetails?.id) return;
    const isPro = userDetails?.plan === "pro";

    if (!isInitialized) {
      setLoading((prev) => ({ ...prev, activities: true }));
    }

    try {
      const response = await services.expense.getPaymentsByUserId(
        userDetails.id,
        0,
        20,
        false
      );

      if (!response || !response.data) return;

      if (isPro) cacheService.savePayments(userDetails.id, response.data).catch(() => {});

      states.expense.setState((prev) => ({
        ...prev,
        activityList: response.data
      }));
    } catch (error) {
      console.error("Failed to fetch recent expenses:", error);
      if (isPro) {
        const cached = await cacheService.getPayments(userDetails.id);
        if (cached) states.expense.setState((prev) => ({ ...prev, activityList: cached }));
      }
    } finally {
      setLoading((prev) => ({ ...prev, activities: false }));
    }
  };

  const fetchGroups = async (isInitialized = false) => {
    if (!userDetails?.id) return;
    const isPro = userDetails?.plan === "pro";

    if (!isInitialized) {
      setLoading((prev) => ({ ...prev, groups: true }));
    }

    try {
      const response = await services.group.getGroupsByUserId(userDetails.id);

      if (!response) return;

      if (isPro) cacheService.saveGroupsList(userDetails.id, response).catch(() => {});

      states.group.setState((prev) => ({
        ...prev,
        list: response
      }));
    } catch (error) {
      console.error("Failed to fetch groups:", error);
      if (isPro) {
        const cached = await cacheService.getGroupsList(userDetails.id);
        if (cached) states.group.setState((prev) => ({ ...prev, list: cached }));
      }
    } finally {
      setLoading((prev) => ({ ...prev, groups: false }));
    }
  };

  const fetchFriends = async (isInitialized = false) => {
    if (!userDetails?.id) return;
    const isPro = userDetails?.plan === "pro";
    if (!isInitialized) setLoading((prev) => ({ ...prev, friends: true }));
    try {
      const data = await services.friend.getFriendsSummary(userDetails.id);
      if (isPro) cacheService.saveFriends(userDetails.id, data).catch(() => {});
      setFriends(data);
    } catch (error) {
      console.error("Failed to fetch friends:", error);
      if (isPro) {
        const cached = await cacheService.getFriends(userDetails.id);
        if (cached) setFriends(cached);
      }
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
        <Box className="sticky top-0 px-4 pt-20 pb-2 bg-primary-400">
          <HStack className="items-center justify-center">
            <VStack className="flex-1">
              <Text className="text-background-0 opacity-80 text-lg">
                Hello,
              </Text>
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
                      <Text className="text-background-0 text-2xs font-semibold">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </Text>
                    </Box>
                  )}
                </Box>
              </Button>
            </HStack>
          </HStack>
        </Box>
        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <VStack className="gap-y-4 bg-background-0 flex-1">
            <Box className="bg-primary-400 max-h-40">
              <Card
                className="m-4 rounded-2xl shadow-lg shadow-primary-400/20"
                variant="elevated"
              >
                <VStack className="gap-y-4">
                  <HStack className="items-center">
                    <Text className="text-secondary-950 font-semibold uppercase flex-1">
                      Your Snapshot
                    </Text>
                  </HStack>
                  <HStack className="gap-x-4 items-center">
                    <StatItem
                      type="RECEIVE"
                      isLoading={loading.activities}
                      items={stats.toReceive}
                      primaryCurrency={defaultCurrency}
                    />
                    <Divider orientation="vertical" />
                    <StatItem
                      type="PAY"
                      isLoading={loading.activities}
                      items={stats.toPay}
                      primaryCurrency={defaultCurrency}
                    />
                  </HStack>
                  <HStack className="gap-x-2">
                    <FormButton
                      className="flex-1"
                      icon={
                        <PlusCircle
                          size={18}
                          color={getSecondaryHex(
                            "text-secondary-0",
                            colorScheme
                          )}
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
                          color={getSecondaryHex(
                            "text-secondary-0",
                            colorScheme
                          )}
                        />
                      }
                      onPress={() => router.push("/groups/create")}
                    />
                  </HStack>
                </VStack>
              </Card>
            </Box>

            <VStack className="mt-[5.5rem]">
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
  const label = type === "PAY" ? "To Pay" : "To Collect";

  return (
    <VStack className="flex-1 gap-y-2">
      <SettlementAvatar isPayer={type === "RECEIVE"} />
      <VStack className="gap-y-1">
        <CurrencyAmountDisplay
          isLoading={isLoading}
          items={items}
          label={label}
          type={type === "PAY" ? "pay" : "receive"}
          primaryCurrency={primaryCurrency}
        />
        <Text className="text-secondary-950">{label}</Text>
      </VStack>
    </VStack>
  );
}
