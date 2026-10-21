import FormButton from "@/components/FormButton";
import FormTextarea from "@/components/FormTextarea";
import UploadImage from "@/components/UploadImage";
import { Box } from "@/components/ui/box";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import useAppToast from "@/hooks/use-app-toast";
import { useActionFeedback } from "@/hooks/useActionFeedback";
import { useEnsureOnline } from "@/hooks/useEnsureOnline";
import services from "@/services";
import type { Payment } from "@/types/expenses";
import { formatDate } from "@/utils/formatDate";
import type { ImagePickerSuccessResult } from "expo-image-picker";
import { useRef, useState } from "react";
import { v4 as uuid } from "uuid";
import { settlementErrorMessage, useSettlementPaymentDetails } from "../hooks/useSettlementPaymentDetails";
import { getRemainingPaymentAmount, isValidPartialPaymentAmount, usesPartialPaymentFlow } from "../utils/settlementPayments.util";
import PartialPaymentFields from "./PartialPaymentFields";
import PaymentModeTabs, { type PaymentMode } from "./PaymentModeTabs";
import SettlementHistoryState from "./SettlementHistoryState";
import SettlementSheetHeader from "./SettlementSheetHeader";
import SettlementSummary from "./SettlementSummary";

export type SettlementPaymentSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  payment: Payment;
  onRefetch: () => void;
  showGroupLink?: boolean;
  onBack?: () => void;
  onBusyChange?: (busy: boolean) => void;
};

export default function SettlementPaymentSheet({ isOpen, onClose, payment: initialPayment,
  onRefetch, showGroupLink = true, onBack, received = false, onBusyChange
}: SettlementPaymentSheetProps & { received?: boolean }) {
  const details = useSettlementPaymentDetails(initialPayment, isOpen);
  const { payment, entries, loading, error } = details;
  const [mode, setMode] = useState<PaymentMode>("full");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState(received ? "Payment acknowledged! 😊" : "Paid with thanks! 😊");
  const [receipt, setReceipt] = useState<ImagePickerSuccessResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentId] = useState(() => uuid());
  const locked = useRef(false);
  const toast = useAppToast();
  const feedback = useActionFeedback();
  const ensureOnline = useEnsureOnline();
  const remaining = getRemainingPaymentAmount(payment);
  const hasPending = entries.some((entry) => entry.status === "requested");
  const partialSettlement = usesPartialPaymentFlow(payment, entries);
  const partialForm = mode === "partial" || partialSettlement;
  const receiverBlocked = received && (mode === "partial" || partialSettlement);
  const valid = !receiverBlocked && !loading && !error && !hasPending && payment.status !== "settled" && remaining > 0 &&
    (mode === "full" || isValidPartialPaymentAmount(amount, remaining));
  const back = () => { if (!locked.current) (onBack ?? onClose)(); };

  const submit = async () => {
    if (locked.current || !valid) return;
    locked.current = true;
    onBusyChange?.(true);
    setSubmitting(true);
    try {
      if (!(await ensureOnline("Recording a payment needs an internet connection."))) return;
      const result = await services.expense.submitSettlementPayment({
        settlementId: payment.id, paymentId, amount: mode === "full" ? remaining : Number(amount),
        mode, received, note, receipt
      });
      // Cosmetic refresh/feedback failures cannot turn a committed payment into
      // a failed submission. Keep the same id on a genuine network retry.
      try { void Promise.resolve(onRefetch()).catch(console.error); } catch (cause) { console.error("Refreshing payment lists:", cause); }
      locked.current = false;
      onBusyChange?.(false);
      onClose();
      void feedback(received ? (result.settled ? "settlement-completed" : "partial-payment-recorded") : "settlement-requested",
        { afterNavigation: true });
    } catch (cause) {
      toast({ title: "Payment Not Verified", description: settlementErrorMessage(cause), type: "error" });
      details.refresh();
    } finally {
      locked.current = false;
      onBusyChange?.(false);
      setSubmitting(false);
    }
  };

  const footer = (
      <Box className="p-4">
        <FormButton text={!partialForm ? (received ? "Mark Settled" : "Request Settled")
          : mode === "partial" ? (received ? "Record Partial Payment" : "Request Partial Payment")
            : received ? "Record Payment" : "Request Payment"}
          disabled={!valid} loading={submitting} onPress={submit} />
      </Box>
  );
  const content = (
    <>
      <SettlementSheetHeader title={!partialForm ? (received ? "Mark as Settled" : "Request as Settled")
        : mode === "partial" ? (received ? "Record Partial Payment" : "Request Partial Payment")
          : "Record Payment"}
        onClose={back} groupId={payment.group_id} showGroupLink={showGroupLink && !submitting} />
      <ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled">
        <VStack className="gap-y-6 pb-6">
          <SettlementHistoryState loading={loading} error={error} onRetry={details.refresh} />
          {!loading && !error && (
            <>
              <SettlementSummary payment={payment} />
              {!received && <PaymentModeTabs value={mode} onChange={setMode} disabled={submitting || hasPending} />}
              {mode === "partial" && (
                <PartialPaymentFields payment={payment} amount={amount} onChangeAmount={setAmount}
                  received={received} confirmedPaidAmount={payment.confirmed_paid_amount ?? 0} />
              )}
              {!partialForm && payment.rejected_at && (
                <VStack className="bg-secondary-100 rounded-xl p-4 gap-y-1">
                  <Text bold className="text-error-500">Previously Rejected</Text>
                  <Text className="text-sm text-secondary-950">
                    {received ? "You rejected the last request on " : "Your last request was rejected on "}
                    {formatDate(payment.rejected_at)}.
                  </Text>
                </VStack>
              )}
              {receiverBlocked ? (
                <Text className="text-secondary-950">Only the sender can record partial or remaining payments. Review their requests in Payment History to confirm or reject them.</Text>
              ) : hasPending ? (
                <Text className="text-secondary-950">{partialForm
                  ? "A payment is awaiting confirmation. Return to payment history to confirm, reject, or withdraw it first."
                  : "A payment is awaiting confirmation. Close this sheet and open the settlement to review it."}</Text>
              ) : remaining === 0 ? (
                <Text className="text-secondary-950">This settlement is fully paid.</Text>
              ) : (
                <>
                  <FormTextarea label="Note (Optional)" placeholder={received ? "Enter note (e.g., Payment acknowledged! 😊)" : "Enter note (e.g., Paid with thanks! 😊)"}
                    value={note} onChangeText={setNote} autoCapitalize="none" />
                  <VStack className="gap-y-1">
                    <UploadImage title="Upload Proof of Payment (Optional)" onSelect={setReceipt} />
                    <Text className="text-sm text-secondary-950">A receipt photo, payment screenshot, or any proof of the payment.</Text>
                  </VStack>
                </>
              )}
            </>
          )}
        </VStack>
      </ScrollView>
    </>
  );
  return <VStack className="flex-1">{content}{footer}</VStack>;
}
