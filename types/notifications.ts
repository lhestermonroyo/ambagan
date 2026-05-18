import { UserPreview } from "./user";

export type NotificationState = {
  list: Notification[];
  unreadCount: number;
};

export type Notification = {
  id: string;
  created_at: string;
  from_user: UserPreview;
  to_user: UserPreview;
  type: NotificationType;
  reference_id: string;
  is_read: boolean;
};

export enum NotificationType {
  SETTLEMENT_REQUEST = "settlement_request",
  SETTLEMENT_APPROVED = "settlement_approved", // when the payer approves the settlement request of the member
  SETTLEMENT_REJECTED = "settlement_rejected", // when the payer rejects the settlement request of the member
  SETTLEMENT_REVERTED = "settlement_reverted", // when the payer reverts an already-approved settlement back to requested
  SETTLEMENT_COMPLETED = "settlement_completed", // when the payer approves the settlement without request from the member
  EXPENSE_INCLUSION = "expense_inclusion",
  GROUP_JOIN = "group_join",
  GROUP_LEAVE = "group_leave"
}
