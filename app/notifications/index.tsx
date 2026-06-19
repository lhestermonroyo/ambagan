import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import ListDivider from "@/components/ListDivider";
import ListFooter from "@/components/ListFooter";
import LoadingWrapper from "@/components/LoadingWrapper";
import { NotificationListSkeleton } from "@/components/SkeletonLoader";
import { Box } from "@/components/ui/box";
import { SectionList } from "@/components/ui/section-list";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { groupByDate } from "@/features/expense/utils/grouping.util";
import NotificationItem from "@/features/notifications/components/NotificationItem";
import InnerLayout from "@/layouts/InnerLayout";
import services from "@/services";
import states from "@/states";
import { EmptyType } from "@/types/general";
import { Notification, NotificationType } from "@/types/notifications";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { RefreshControl } from "react-native";

export default function NotificationsScreen() {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [page, setPage] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);

  const { list, unreadCount } = states.notification();
  const { details: userDetails } = states.user();

  const router = useRouter();

  const sections = useMemo(() => groupByDate(list), [list]);

  useEffect(() => {
    if (userDetails?.id) {
      fetchNotifications(0, true);
    }
  }, [userDetails?.id]);

  const fetchNotifications = async (
    pageNum: number = 0,
    showLoading = false
  ) => {
    if (!userDetails?.id) return;

    if (showLoading) setLoading(true);

    try {
      const response = await services.notification.getNotificationsByUserId(
        userDetails.id,
        pageNum,
        12
      );

      if (!response?.data) return;

      states.notification.setState((prev) => ({
        ...prev,
        list: pageNum === 0 ? response.data : [...prev.list, ...response.data]
      }));

      setPage(pageNum);
      setHasNextPage(response.pagination?.hasNext || false);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchNotifications(0);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLoadMore = async () => {
    setLoadMoreLoading(true);
    try {
      await fetchNotifications(page + 1);
    } finally {
      setLoadMoreLoading(false);
    }
  };

  const handlePress = async (notification: Notification) => {
    const isSettlement = [
      NotificationType.SETTLEMENT_REQUEST,
      NotificationType.SETTLEMENT_APPROVED,
      NotificationType.SETTLEMENT_REJECTED,
      NotificationType.SETTLEMENT_COMPLETED
    ].includes(notification.type);

    if (isSettlement) {
      const friend = notification.from_user;
      const openHistory = [
        NotificationType.SETTLEMENT_APPROVED,
        NotificationType.SETTLEMENT_COMPLETED
      ].includes(notification.type);
      router.push({
        pathname: "/friends/[friendId]",
        params: {
          friendId: friend.id,
          name: `${friend.first_name} ${friend.last_name}`,
          email: friend.email,
          avatar: friend.avatar || "",
          ...(openHistory && { tab: "History" })
        }
      } as any);
    } else {
      const route = await services.notification.getNotificationRoute(
        notification.type,
        notification.reference_id
      );

      if (route) {
        router.push(route as any);
      }
    }

    if (!notification.is_read) {
      try {
        await services.notification.markNotificationAsRead(notification.id);
        states.notification.setState((prev) => ({
          ...prev,
          list: prev.list.map((n) =>
            n.id === notification.id ? { ...n, is_read: true } : n
          ),
          unreadCount: Math.max(0, prev.unreadCount - 1)
        }));
      } catch (error) {
        console.error("Failed to mark notification as read:", error);
      }
    }
  };

  const handleMarkAllRead = async () => {
    if (!userDetails?.id || unreadCount === 0) return;
    setMarkingAll(true);
    try {
      await services.notification.markAllNotificationsAsRead(userDetails.id);
      states.notification.setState((prev) => ({
        ...prev,
        list: prev.list.map((n) => ({ ...n, is_read: true })),
        unreadCount: 0
      }));
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <InnerLayout
      title="Notifications"
      onBack={() => router.back()}
      actions={
        unreadCount > 0
          ? [
              <FormButton
                key="mark-all"
                text={markingAll ? "Marking..." : "Mark all read"}
                variant="link"
                onPress={handleMarkAllRead}
                disabled={markingAll}
              />
            ]
          : undefined
      }
    >
      <LoadingWrapper isLoading={loading} skeleton={<NotificationListSkeleton />}>
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          renderItem={({ item }) => (
            <NotificationItem item={item} onPress={handlePress} />
          )}
          renderSectionHeader={({ section: { title } }) => (
            <Box className="bg-background-50 px-4 py-2 border-b border-secondary-100">
              <Text className="text-sm text-secondary-950">{title}</Text>
            </Box>
          )}
          ItemSeparatorComponent={ListDivider}
          stickySectionHeadersEnabled={true}
          ListEmptyComponent={() => (
            <VStack className="flex-1 items-center justify-center p-8">
              <EmptyList type={EmptyType.NOTIFICATION} />
            </VStack>
          )}
          ListFooterComponent={
            list.length > 0 ? (
              <ListFooter
                hasNextPage={hasNextPage}
                loading={loadMoreLoading}
                onLoadMore={handleLoadMore}
                showEndMessage
              />
            ) : null
          }
        />
      </LoadingWrapper>
    </InnerLayout>
  );
}
