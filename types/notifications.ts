import { PaymentStatus } from "./expenses";
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
  /**
   * Live status of the referenced settlement (payment_split), resolved at fetch
   * time so the row can reflect current state rather than the frozen event
   * `type`. Null for non-settlement notifications or when the split (e.g. its
   * expense) no longer exists. Undefined when not yet resolved (e.g. offline).
   */
  settlement_status?: PaymentStatus | null;
};

export enum NotificationType {
  SETTLEMENT_REQUEST = "settlement_request",
  SETTLEMENT_APPROVED = "settlement_approved", // when the payer approves the settlement request of the member
  SETTLEMENT_REJECTED = "settlement_rejected", // when the payer rejects the settlement request of the member
  SETTLEMENT_REVERTED = "settlement_reverted", // when the payer reverts an already-approved settlement back to requested
  SETTLEMENT_COMPLETED = "settlement_completed", // when the payer approves the settlement without request from the member
  EXPENSE_INCLUSION = "expense_inclusion",
  GROUP_JOIN = "group_join",
  GROUP_LEAVE = "group_leave",
  RECURRING_POSTED = "recurring_posted", // a recurring template auto-posted an expense (group or book)
  RECURRING_REVIEW = "recurring_review" // a group recurring expense posted as a draft and needs finalizing
}

/**
 * Notification types whose `reference_id` points at a payment_split and whose
 * live status can drift after the event. Single source of truth for the "is
 * this a settlement notification?" check used across rendering and routing so
 * new types (e.g. SETTLEMENT_REVERTED) can't be forgotten in one place.
 */
export const SETTLEMENT_NOTIFICATION_TYPES: readonly NotificationType[] = [
  NotificationType.SETTLEMENT_REQUEST,
  NotificationType.SETTLEMENT_APPROVED,
  NotificationType.SETTLEMENT_REJECTED,
  NotificationType.SETTLEMENT_REVERTED,
  NotificationType.SETTLEMENT_COMPLETED
];

export function isSettlementNotification(type: NotificationType): boolean {
  return SETTLEMENT_NOTIFICATION_TYPES.includes(type);
}

/**
 * Notification types raised by the recurring generator (`run-recurring`). They
 * are the only ones a user sends to *themselves*, and their `reference_id` can
 * point at either a group expense or a personal (book) expense — so both the
 * rendering and the routing paths have to treat them as their own family.
 */
export const RECURRING_NOTIFICATION_TYPES: readonly NotificationType[] = [
  NotificationType.RECURRING_POSTED,
  NotificationType.RECURRING_REVIEW
];

export function isRecurringNotification(type: NotificationType): boolean {
  return RECURRING_NOTIFICATION_TYPES.includes(type);
}
