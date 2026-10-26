import { useEffect, useState } from "react";
import services from "@/services";
import type { Payment } from "@/types/expenses";
import type { SettlementPaymentEntry } from "@/types/settlementPayments";
import { getConfirmedPaymentAmount } from "../utils/settlementPayments.util";

export function settlementErrorMessage(error: unknown): string {
  const cause = error && typeof error === "object" ? error as { message?: string; code?: string } : {};
  const message = typeof cause.message === "string" ? cause.message : "";
  // Business-rule exceptions are written for the person making the payment.
  // PostgREST/schema/storage diagnostics belong in logs, not in the sheet.
  if (cause.code === "P0001" && message) return message;
  if (cause.code === "PGRST116") return "This settlement is no longer available. Close it and refresh the list.";
  if (cause.code === "23505") return "A payment is already awaiting confirmation. Refresh its history to review it.";
  if (/network|failed to fetch|fetch failed|timeout|aborted/i.test(message))
    return "Unable to connect. Check your connection and try again.";
  if (!cause.code && /^(Unable to (verify|load|upload)|Choose a proof)/.test(message)) return message;
  return "Unable to verify this payment. Refresh its history and try again.";
}

export function useSettlementPaymentDetails(payment: Payment, isOpen: boolean) {
  const [request, setRequest] = useState({ id: payment?.id, isOpen, revision: 0 });
  const [resource, setResource] = useState<{
    request: typeof request;
    data?: { payment: Payment; entries: SettlementPaymentEntry[] };
    error?: string;
  } | null>(null);
  // Reset the resource identity on reopen or when changing settlements. This
  // prevents a previously loaded balance enabling actions for the first frame.
  if (request.id !== payment?.id || request.isOpen !== isOpen) {
    setRequest({ id: payment?.id, isOpen, revision: request.revision + 1 });
  }

  useEffect(() => {
    if (!request.isOpen || !request.id) return;
    let active = true;
    services.expense.getSettlementPaymentDetails(request.id).then((result) => {
      if (Math.abs(getConfirmedPaymentAmount(result.entries) - (result.payment.confirmed_paid_amount ?? 0)) > 0.001 ||
          result.entries.length !== (result.payment.payment_history_count ?? 0)) {
        throw new Error("Unable to load the complete payment history. Please refresh.");
      }
      if (active) setResource({ request, data: result });
    }).catch((cause) => {
      if (active) setResource({ request, error: settlementErrorMessage(cause) });
    });
    return () => { active = false; };
  }, [request]);

  const current = resource?.request === request ? resource : null;
  return {
    payment: current?.data?.payment ?? payment,
    entries: current?.data?.entries ?? [],
    loading: isOpen && !current,
    error: current?.error ?? null,
    refresh: () => setRequest((value) => ({ ...value, revision: value.revision + 1 }))
  };
}
