import AppAvatar from "@/components/AppAvatar";
import Icon from "@/components/Icon";
import PressableListItem from "@/components/PressableListItem";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import StatusBadge from "@/features/expense/components/StatusBadge";
import {
  isRecurringNotification,
  Notification,
  NotificationType
} from "@/types/notifications";
import { formatDate } from "@/utils/formatDate";
import { getPrimaryHex } from "@/utils/getColorHex";
import { Repeat } from "lucide-react-native";
import { useColorScheme } from "nativewind";

/**
 * Recurring notifications are raised by the generator on your own behalf, so
 * `from_user` is you — "<your name> posted a recurring expense" reads like
 * someone else did it. These render as a standalone sentence with a repeat
 * glyph instead of the usual "<name> <suffix>" + avatar row.
 */
function getRecurringMessage(type: NotificationType): string {
  return type === NotificationType.RECURRING_REVIEW
    ? "A recurring expense posted as a draft and needs your review."
    : "A recurring expense posted automatically.";
}

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
  const { colorScheme } = useColorScheme();
  const fromName = `${item.from_user.first_name} ${item.from_user.last_name}`;
  const type = item.type as NotificationType;
  const isRecurring = isRecurringNotification(type);
  const suffix = getNotificationSuffix(type);

  return (
    <PressableListItem className="p-4" onPress={() => onPress(item)}>
      <HStack className="gap-x-3">
        {isRecurring ? (
          <Box className="w-12 h-12 rounded-full bg-primary-50 items-center justify-center">
            <Repeat
              size={20}
              color={getPrimaryHex("text-primary-600", colorScheme ?? "light")}
            />
          </Box>
        ) : (
          <AppAvatar
            name={fromName}
            uri={item.from_user.avatar ?? undefined}
            size="md"
          />
        )}
        <VStack className="flex-1 gap-y-1">
          <Text numberOfLines={3}>
            {isRecurring ? (
              getRecurringMessage(type)
            ) : (
              <>
                <Text className="font-medium">{fromName}</Text> {suffix}
              </>
            )}
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
