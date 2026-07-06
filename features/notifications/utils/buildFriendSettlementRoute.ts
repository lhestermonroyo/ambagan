import { NotificationType } from "@/types/notifications";
import { UserPreview } from "@/types/user";

/**
 * Builds the friend-detail navigation for a settlement notification. Both the
 * in-app notifications list and the push-notification tap handler use this so a
 * tap lands on the same place regardless of entry point: the friend screen with
 * the referenced settlement's sheet auto-opened and its row highlighted (driven
 * by the `settlementId` param).
 */
export function buildFriendSettlementRoute(
  type: NotificationType,
  friend: UserPreview,
  settlementId: string
) {
  // Approved/completed settlements live under the "History" (Settled) tab;
  // everything else surfaces under the default "All" tab.
  const openHistory =
    type === NotificationType.SETTLEMENT_APPROVED ||
    type === NotificationType.SETTLEMENT_COMPLETED;

  return {
    pathname: "/friends/[friendId]",
    params: {
      friendId: friend.id,
      name: `${friend.first_name} ${friend.last_name}`,
      email: friend.email,
      avatar: friend.avatar || "",
      settlementId,
      ...(openHistory && { tab: "History" })
    }
  };
}
