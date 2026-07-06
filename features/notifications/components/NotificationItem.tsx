import AppAvatar from "@/components/AppAvatar";
import Icon from "@/components/Icon";
import PressableListItem from "@/components/PressableListItem";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import StatusBadge from "@/features/expense/components/StatusBadge";
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
    case NotificationType.SETTLEMENT_REVERTED:
      return "reopened your settlement for review.";
    case NotificationType.SETTLEMENT_COMPLETED:
      return "completed a settlement.";
    case NotificationType.EXPENSE_INCLUSION:
      return "added you to an expense.";
    case NotificationType.GROUP_JOIN:
      return "joined you to a group.";
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
      <HStack className="gap-x-2">
        <AppAvatar
          name={fromName}
          uri={item.from_user.avatar ?? undefined}
          size="md"
        />
        <VStack className="flex-1 gap-y-1">
          <Text numberOfLines={3}>
            <Text className="font-medium">{fromName}</Text> {suffix}
          </Text>
          <HStack className="items-center gap-x-2">
            <Text className="text-sm text-secondary-950">
              {formatDate(item.created_at)}
            </Text>
            {/* The message is a frozen record of the event; the badge shows the
                settlement's live status so a since-resolved request reads right.
                An explicit null means the settlement was resolved but no longer
                exists — flag it so the row doesn't look like a live tap target. */}
            {item.settlement_status ? (
              <StatusBadge status={item.settlement_status} size="sm" />
            ) : item.settlement_status === null ? (
              <Text className="text-sm text-secondary-500">
                No longer available
              </Text>
            ) : null}
          </HStack>
        </VStack>
        <HStack className="items-center justify-center">
          {!item.is_read && (
            <Box className="w-4 h-4 rounded-full bg-primary-400" />
          )}
          <Icon as="chevron-right" className="text-secondary-950" />
        </HStack>
      </HStack>
    </PressableListItem>
  );
}
