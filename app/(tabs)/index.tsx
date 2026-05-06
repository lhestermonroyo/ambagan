import FormButton from "@/components/FormButton";
import LoadingWrapper from "@/components/LoadingWrapper";
import { Avatar } from "@/components/ui/avatar";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { KeyboardAvoidingView } from "@/components/ui/keyboard-avoiding-view";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import CurrencyAmountDisplay from "@/features/expense/components/CurrencyAmountDisplay";
import SettlementActionSheet from "@/features/expense/components/SettlementActionSheet";
import SettlementItem from "@/features/expense/components/SettlementItem";
import GroupItem from "@/features/group/components/GroupItem";
import NotificationSheet from "@/features/notifications/components/NotificationSheet";
import services from "@/services";
import states from "@/states";
import { PaymentPreview } from "@/types/expenses";
import {
  getErrorHex,
  getSecondaryHex,
  getSuccessHex
} from "@/utils/getColorHex";
import { useFocusEffect, useRouter } from "expo-router";
import {
  BanknoteArrowDown,
  BanknoteArrowUp,
  Bell,
  HousePlus,
  PlusCircle
} from "lucide-react-native";
import { Fragment, useMemo, useState } from "react";

export default function HomeScreen() {
  const [loading, setLoading] = useState({
    activities: false,
    groups: false
  });
  const [stats, setStats] = useState<{
    toPay: { currency: string; amount: number }[];
    toReceive: { currency: string; amount: number }[];
  }>({ toPay: [], toReceive: [] });

  const [initialized, setInitialized] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentPreview | null>(
    null
  );
  const [actionSheetOpen, setActionSheetOpen] = useState(false);

  const { details: userDetails, signOut } = states.user();
  const { list: groupList } = states.group();
  const { activityList } = states.expense();
  const { unreadCount } = states.notification();

  const router = useRouter();

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
      fetchStats(),
      fetchGroups(isInitialized),
      fetchActivities(isInitialized),
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

  const fetchStats = async () => {
    try {
      const response = await services.expense.getStatsByUserId(
        userDetails?.id || ""
      );

      if (!response) return;

      setStats({
        toPay: response.toPay,
        toReceive: response.toReceive
      });
    } catch (error) {
      console.error("Failed to fetch expense statistics:", error);
    }
  };

  const fetchActivities = async (isInitialized = false) => {
    if (!userDetails?.id) return;

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
    if (!userDetails?.id) return;

    if (!isInitialized) {
      setLoading((prev) => ({ ...prev, groups: true }));
    }

    try {
      const response = await services.group.getGroupsByUserId(userDetails.id);

      if (!response) return;

      states.group.setState((prev) => ({
        ...prev,
        list: response
      }));
    } catch (error) {
      console.error("Failed to fetch groups:", error);
    } finally {
      setLoading((prev) => ({ ...prev, groups: false }));
    }
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
            <Button
              variant="link"
              className="rounded-full"
              onPress={() => setNotificationsOpen(true)}
            >
              <Box className="relative">
                <Bell size={24} color={getSecondaryHex("text-secondary-0")} />
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
        </Box>
        <ScrollView className="flex-1" bounces={false}>
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
                    <StatItem type="RECEIVE" items={stats.toReceive} />
                    <Divider orientation="vertical" />
                    <StatItem type="PAY" items={stats.toPay} />
                  </HStack>
                  <HStack className="gap-x-2">
                    <FormButton
                      className="flex-1"
                      icon={
                        <PlusCircle
                          size={18}
                          color={getSecondaryHex("text-secondary-0")}
                        />
                      }
                      text="New Expense"
                      onPress={() =>
                        router.push("/groups/[groupId]/new-expense")
                      }
                    />
                    <FormButton
                      className="flex-1"
                      text="Create Group"
                      icon={
                        <HousePlus
                          size={18}
                          color={getSecondaryHex("text-secondary-0")}
                        />
                      }
                      onPress={() => router.push("/groups/create")}
                    />
                  </HStack>
                </VStack>
              </Card>
            </Box>

            <VStack className="mt-24">
              <HStack className="items-center justify-between px-4">
                <Text bold className="text-2xl">
                  Recent Activities
                </Text>
                <FormButton
                  text="View All"
                  variant="link"
                  onPress={() => router.push("/activities")}
                />
              </HStack>
              <LoadingWrapper
                text="Loading activities"
                isLoading={loading.activities}
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
                  ItemSeparatorComponent={() => (
                    <Box className="mx-4">
                      <Divider className="border-secondary-100" />
                    </Box>
                  )}
                  ListEmptyComponent={() => (
                    <VStack className="flex-1 justify-center items-center p-4">
                      <Text className="text-secondary-950">
                        No activities recorded yet.
                      </Text>
                    </VStack>
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
                text="Loading previous groups"
                isLoading={loading.groups}
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
                  ItemSeparatorComponent={() => (
                    <Box className="mx-4">
                      <Divider className="border-secondary-100" />
                    </Box>
                  )}
                  ListEmptyComponent={() => (
                    <VStack className="flex-1 justify-center items-center p-4">
                      <Text className="text-secondary-950">
                        No groups joined or created yet.
                      </Text>
                    </VStack>
                  )}
                />
              </LoadingWrapper>
            </VStack>
          </VStack>
        </ScrollView>
      </KeyboardAvoidingView>
      <NotificationSheet
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />
      <SettlementActionSheet
        isOpen={actionSheetOpen}
        onClose={() => setActionSheetOpen(false)}
        item={selectedPayment}
        onRefetch={() => init(true)}
      />
    </Fragment>
  );
}

function StatItem({
  type,
  items
}: {
  type: "RECEIVE" | "PAY";
  items: { currency: string; amount: number }[];
}) {
  const label = type === "PAY" ? "To Pay" : "To Collect";

  return (
    <VStack className="flex-1 gap-y-2">
      {type === "RECEIVE" ? (
        <Avatar size="sm" className="bg-success-100 border border-success-200">
          <BanknoteArrowUp size={16} color={getSuccessHex("text-success-600")} />
        </Avatar>
      ) : (
        <Avatar size="sm" className="bg-error-100 border border-error-200">
          <BanknoteArrowDown size={16} color={getErrorHex("text-error-600")} />
        </Avatar>
      )}
      <VStack className="gap-y-1">
        <CurrencyAmountDisplay
          items={items}
          label={label}
          type={type === "PAY" ? "pay" : "receive"}
        />
        <Text className="text-secondary-950">{label}</Text>
      </VStack>
    </VStack>
  );
}
