import AppAvatar from "@/components/AppAvatar";
import PressableListItem from "@/components/PressableListItem";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Notification, NotificationType } from "@/types/notifications";
import { formatDate } from "@/utils/formatDate";

function getNotificationSuffix(type: NotificationType): string {
  switch (type) {
    case NotificationType.SETTLEMENT_REQUEST:
      return "submitted a settlement request for your review.";
    case NotificationType.SETTLEMENT_APPROVED:
      return "approved your settlement request.";
    case NotificationType.SETTLEMENT_REJECTED:
      return "rejected your settlement request.";
    case NotificationType.SETTLEMENT_COMPLETED:
      return "completed a settlement.";
    case NotificationType.EXPENSE_INCLUSION:
      return "added you to an expense.";
    case NotificationType.GROUP_JOIN:
      return "joined the group.";
    case NotificationType.GROUP_LEAVE:
      return "left the group.";
    default:
      return "sent you a notification.";
  }
}

export default function NotificationItem({
  item,
  onPress
}: {
  item: Notification;
  onPress: (notification: Notification) => void;
}) {
  const fromName = `${item.from_user.first_name} ${item.from_user.last_name}`;
  const suffix = getNotificationSuffix(item.type as NotificationType);

  return (
    <PressableListItem className="p-4" onPress={() => onPress(item)}>
      <HStack className="gap-x-3 items-start">
        <AppAvatar
          name={fromName}
          uri={item.from_user.avatar ?? undefined}
          size="md"
        />
        <VStack className="flex-1 gap-y-1">
          <Text numberOfLines={3}>
            <Text className="font-medium">{fromName}</Text> {suffix}
          </Text>
          <Text className="text-secondary-950">
            {formatDate(item.created_at)}
          </Text>
        </VStack>
        {!item.is_read && (
          <Box className="w-2 h-2 rounded-full bg-primary-400 mt-1" />
        )}
      </HStack>
    </PressableListItem>
  );
}
