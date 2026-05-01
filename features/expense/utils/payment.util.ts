import { Payment } from "@/types/expenses";

const SETTLEMENT_STATUS_ORDER: Record<string, number> = {
  requested: 0,
  pending: 1,
  settled: 2
};

export const sortPaymentsByStatus = (payments: Payment[]): Payment[] =>
  [...payments].sort(
    (a, b) =>
      (SETTLEMENT_STATUS_ORDER[a.status] ?? 99) -
      (SETTLEMENT_STATUS_ORDER[b.status] ?? 99)
  );
