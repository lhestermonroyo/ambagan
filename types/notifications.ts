import { UserPreview } from "./user";

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
  PAYMENT_REQUEST = "payment_request",
  PAYMENT_APPROVED = "payment_approved", // when the payer approves the payment request of the member
  PAYMENT_COMPLETED = "payment_completed", // when the payer approves the payment without request from the member
  PAYMENT_REJECTED = "payment_rejected",
  EXPENSE_INCLUSION = "expense_inclusion",
  GROUP_JOIN = "group_join",
  GROUP_LEAVE = "group_leave",
  GROUP_ARCHIVE = "group_archive",
  GROUP_UNARCHIVE = "group_unarchive"
}
