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
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import NotificationItem from "@/features/notifications/components/NotificationItem";
import services from "@/services";
import states from "@/states";
import { Notification, NotificationType } from "@/types/notifications";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import FormButton from "../../../components/FormButton";
import Icon from "../../../components/Icon";
import LoadingWrapper from "../../../components/LoadingWrapper";

export default function NotificationSheet({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [page, setPage] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);

  const { list, unreadCount } = states.notification();
  const { details: userDetails } = states.user();

  const router = useRouter();

  useEffect(() => {
    if (isOpen && userDetails?.id) {
      fetchNotifications(0, true);
    }
  }, [isOpen, userDetails?.id]);

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
        list:
          pageNum === 0
            ? response.data
            : [...prev.list, ...response.data]
      }));

      setPage(pageNum);
      setHasNextPage(response.pagination?.hasNext || false);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
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
      onClose();
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
        onClose();
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
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[94]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <VStack className="w-full py-4 flex-1 gap-y-4">
          <HStack className="items-center px-4">
            <Button variant="link" className="rounded-full" onPress={onClose}>
              <Icon as="arrow-back-ios" className="text-secondary-950" />
            </Button>
            <HStack className="flex-1 items-center gap-x-2">
              <Text bold className="text-xl">
                Notifications
              </Text>
              {unreadCount > 0 && (
                <Box className="bg-primary-400 rounded-full h-6 w-6 flex items-center justify-center">
                  <Text className="text-background-0 text-xs font-semibold">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </Box>
              )}
            </HStack>
            {unreadCount > 0 && (
              <FormButton
                text={markingAll ? "Marking..." : "Mark all read"}
                variant="link"
                onPress={handleMarkAllRead}
                disabled={markingAll}
              />
            )}
          </HStack>

          <LoadingWrapper
            isLoading={loading}
            text="Loading notifications..."
          >
            <FlatList
              data={list}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <NotificationItem item={item} onPress={handlePress} />
              )}
              ItemSeparatorComponent={() => (
                <Box className="mx-4">
                  <Divider className="border-secondary-100" />
                </Box>
              )}
              ListEmptyComponent={() => (
                <VStack className="flex-1 items-center justify-center p-8">
                  <Text className="text-secondary-950 text-center">
                    No notifications yet.
                  </Text>
                </VStack>
              )}
              ListFooterComponent={
                list.length > 0 ? (
                  hasNextPage ? (
                    <FormButton
                      size="md"
                      variant="outline"
                      className="mx-4 my-2"
                      text="Load More"
                      loading={loadMoreLoading}
                      onPress={handleLoadMore}
                    />
                  ) : (
                    <VStack className="justify-center items-center p-4">
                      <Text className="text-secondary-950 text-center">
                        You've reached the end.
                      </Text>
                    </VStack>
                  )
                ) : null
              }
            />
          </LoadingWrapper>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
