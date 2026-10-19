import { Payment } from "@/types/expenses";
import { formatDate } from "@/utils/formatDate";

/**
 * The subset of a settlement needed to derive its lifecycle timestamps. Both
 * Payment and PaymentPreview satisfy it (the preview's lifecycle fields are
 * optional — offline-generated previews omit them).
 */
type SettlementLike = Pick<Payment, "created_at"> &
  Partial<Pick<Payment, "requested_at" | "settled_at" | "rejected_at" | "status_updated_at" | "payment_history_count">>;

/**
 * Timestamp of the most recent lifecycle action on a settlement:
 *   requests, confirmations, rejections, withdrawals, and reopened payments.
 *
 * Uses the latest of the action dates so it stays correct regardless of the
 * order they were written (a rejection reverts status to 'pending' but keeps
 * rejected_at, so we can't lean on `status` alone). Falls back to created_at
 * when nothing has happened yet.
 */
export const getSettlementUpdatedAt = (item: SettlementLike): string => {
  const actions = [
    item.requested_at,
    item.settled_at,
    item.rejected_at,
    item.payment_history_count ? item.status_updated_at : undefined
  ].filter((d): d is string => !!d);

  if (actions.length === 0) return item.created_at;

  return actions.reduce((latest, d) =>
    new Date(d).getTime() > new Date(latest).getTime() ? d : latest
  );
};

/** True once a settlement or one of its payments has been acted on. */
export const isSettlementUpdated = (item: SettlementLike): boolean =>
  !!(item.requested_at || item.settled_at || item.rejected_at ||
    (item.payment_history_count && item.status_updated_at));

/**
 * Label for a settlement row's timestamp: "Updated <date>" once it has been
 * acted on, otherwise just the created date.
 */
export const getSettlementDateLabel = (item: SettlementLike): string => {
  const date = formatDate(getSettlementUpdatedAt(item));
  return isSettlementUpdated(item) ? `Updated ${date}` : date;
};
