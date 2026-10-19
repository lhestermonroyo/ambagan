import type { SettlementPaymentAction, SettlementPaymentEntry, SettlementPaymentResult } from "@/types/settlementPayments";
import { NotificationType } from "@/types/notifications";
import { tables } from "@/utils/constants";
import { sendPushNotification } from "@/utils/sendPushNotifications";
import { supabase } from "@/utils/supabase";
import { uploadFile } from "@/utils/upload";
import type { ImagePickerSuccessResult } from "expo-image-picker";

export const getSettlementPaymentHistory = async (settlementId: string): Promise<SettlementPaymentEntry[]> => {
  const { data, error } = await supabase.from(tables.SETTLEMENT_PAYMENTS_TBL)
    .select("*").eq("settlement_id", settlementId).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
};

// The RPC writes the in-app notification in the same transaction. Push is
// best-effort and must never make an already-saved payment appear to fail.
async function pushPayment(result: SettlementPaymentResult, action: "request" | "record" | SettlementPaymentAction) {
  if (!result.changed || action === "withdraw") return;
  const to = action === "request" ? result.payer_id : result.member_id;
  if (!to) return;
  const type = action === "request" ? NotificationType.SETTLEMENT_REQUEST
    : action === "reject" ? NotificationType.SETTLEMENT_REJECTED
      : action === "reopen" ? NotificationType.SETTLEMENT_REVERTED
        : action === "record" ? NotificationType.SETTLEMENT_COMPLETED : NotificationType.SETTLEMENT_APPROVED;
  try {
    await sendPushNotification(to, type, {
      title: action === "request" ? "Payment Submitted for Review" : action === "reject" ? "Payment Request Rejected"
        : action === "reopen" ? "Payment Reopened" : "Payment Confirmed",
      body: action === "request" ? "A payment is ready for your review."
        : action === "reject" ? "Review the payment history for details."
          : action === "reopen" ? "This payment is awaiting confirmation again."
            : result.settled ? "This settlement is now fully paid." : "The payment is confirmed and the remaining balance has been updated.",
      referenceId: result.settlement_id
    });
  } catch (error) {
    console.error("Payment saved; push delivery failed:", error);
  }
}

export const submitSettlementPayment = async (payload: {
  settlementId: string;
  paymentId: string;
  amount: number;
  mode: "full" | "partial";
  received: boolean;
  note: string;
  receipt: ImagePickerSuccessResult | null;
}): Promise<SettlementPaymentResult> => {
  let proof: string | null = null;
  if (payload.receipt) {
    const asset = payload.receipt.assets[0];
    if (!asset) throw new Error("Choose a proof of payment image again.");
    const upload = await uploadFile(asset, "receipts");
    if (upload.error || !upload.data?.publicUrl) throw new Error("Unable to upload proof of payment. Please try again.");
    proof = upload.data.publicUrl;
  }
  const { data, error } = await supabase.rpc("submit_settlement_payment", {
    p_settlement_id: payload.settlementId, p_payment_id: payload.paymentId,
    p_amount: payload.amount, p_mode: payload.mode, p_note: payload.note,
    p_proof: proof, p_received: payload.received
  });
  if (error) throw error;
  if (!data?.payment) throw new Error("Unable to verify the payment. Refresh its history before retrying.");
  const result = data as SettlementPaymentResult;
  void pushPayment(result, payload.received ? "record" : "request");
  return result;
};

export const transitionSettlementPayment = async (
  paymentId: string, action: SettlementPaymentAction, note = ""
): Promise<SettlementPaymentResult> => {
  const { data, error } = await supabase.rpc("transition_settlement_payment", {
    p_payment_id: paymentId, p_action: action, p_note: note
  });
  if (error) throw error;
  if (!data?.payment) throw new Error("Unable to verify the payment update.");
  const result = data as SettlementPaymentResult;
  void pushPayment(result, action);
  return result;
};
