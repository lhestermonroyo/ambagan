import type { SettlementPaymentEntry } from "@/types/settlementPayments";
import type { Payment, PaymentPreview } from "@/types/expenses";
import { groupByCurrency } from "@/utils/currency";

/** Requested, rejected and withdrawn amounts never reduce the amount due. */
export const getConfirmedPaymentAmount = (
  entries: readonly SettlementPaymentEntry[]
): number =>
  entries.reduce(
    (total, entry) =>
      entry.status === "confirmed" ? total + entry.amount : total,
    0
  );

export const getRemainingPaymentAmount = (
  payment: Pick<Payment | PaymentPreview, "amount" | "confirmed_paid_amount">
): number => Math.max(0, Math.round((payment.amount - (payment.confirmed_paid_amount ?? 0)) * 100) / 100);

export const hasSettlementHistory = (
  payment: Pick<Payment | PaymentPreview, "status" | "confirmed_paid_amount" | "payment_history_count">
): boolean => payment.status !== "pending" || (payment.confirmed_paid_amount ?? 0) > 0 || (payment.payment_history_count ?? 0) > 0;

/** History alone does not imply partial payments: full requests may have been
 * rejected, withdrawn or reopened. Preserve the partial flow after its final
 * remaining payment too, using the persisted flag or the actual ledger. */
export const usesPartialPaymentFlow = (
  payment: Pick<Payment | PaymentPreview, "amount" | "confirmed_paid_amount" | "requested_payment_amount" | "has_partial_payments">,
  entries: readonly SettlementPaymentEntry[] = []
): boolean => payment.has_partial_payments === true ||
  ((payment.confirmed_paid_amount ?? 0) > 0 && (payment.confirmed_paid_amount ?? 0) < payment.amount) ||
  ((payment.requested_payment_amount ?? 0) > 0 && (payment.requested_payment_amount ?? 0) < payment.amount) ||
  entries.some((entry) => entry.mode === "partial" || entry.amount < payment.amount);

export const isValidPartialPaymentAmount = (amount: string, remaining: number): boolean =>
  /^\d+(\.\d{0,2})?$/.test(amount) && Number.isFinite(Number(amount)) &&
  Number(amount) > 0 && Number(amount) < remaining;

/** Balance totals use remaining amounts for active settlements; paid history
 * keeps its original amount so settled exports and totals stay meaningful. */
export const settlementBalanceRows = <T extends Pick<Payment, "amount" | "status" | "confirmed_paid_amount">>(rows: T[]) =>
  rows.map((row) => ({ ...row, amount: row.status === "settled" ? row.amount : getRemainingPaymentAmount(row) }));

export const groupSettlementBalancesByCurrency = (rows: (Payment | PaymentPreview)[]) =>
  groupByCurrency(settlementBalanceRows(rows));
