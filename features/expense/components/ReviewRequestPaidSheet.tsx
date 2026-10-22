import FormButton from "@/components/FormButton";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import useUserState from "@/features/user/states/user.state";
import useAppToast from "@/hooks/use-app-toast";
import { useActionFeedback } from "@/hooks/useActionFeedback";
import { useEnsureOnline } from "@/hooks/useEnsureOnline";
import services from "@/services";
import type { Payment } from "@/types/expenses";
import type { SettlementPaymentAction, SettlementPaymentEntry } from "@/types/settlementPayments";
import { BanknoteArrowUp, Info } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { BackHandler } from "react-native";
import { settlementErrorMessage, useSettlementPaymentDetails } from "../hooks/useSettlementPaymentDetails";
import { getRemainingPaymentAmount, usesPartialPaymentFlow } from "../utils/settlementPayments.util";
import FullSettlementReview from "./FullSettlementReview";
import SettlementPaymentSheet from "./SettlementPaymentSheet";
import SettlementSheetPager from "./SettlementSheetPager";
import SettlementHistoryState from "./SettlementHistoryState";
import SettlementPaymentHistory from "./SettlementPaymentHistory";
import SettlementSheetHeader from "./SettlementSheetHeader";
import SettlementSummary from "./SettlementSummary";

export default function ReviewRequestPaidSheet({ isOpen, onClose, onRefetch, payment: initialPayment,
  readOnly = false, showGroupLink = true, onBusyChange
}: {
  isOpen: boolean;
  onClose: () => void;
  onRefetch: () => void;
  payment: Payment;
  /** Kept for callers; permissions always come from the signed-in user's ID. */
  isPayer?: boolean;
  readOnly?: boolean;
  showGroupLink?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const details = useSettlementPaymentDetails(initialPayment, isOpen);
  const { payment, entries, loading, error } = details;
  const userId = useUserState((state) => state.details?.id);
  const [remainingPaymentOpen, setRemainingPaymentOpen] = useState(false);
  const [busyPaymentId, setBusyPaymentId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<SettlementPaymentAction | null>(null);
  const locked = useRef(false);
  const toast = useAppToast();
  const feedback = useActionFeedback();
  const ensureOnline = useEnsureOnline();
  const isMember = payment.member.id === userId;
  const isRecipient = payment.payer.id === userId;
  const ready = !loading && !error;
  const partialSettlement = usesPartialPaymentFlow(payment, entries);
  const hasPending = entries.some((entry) => entry.status === "requested");
  const canAddPayment = !readOnly && isMember && payment.status !== "settled" && getRemainingPaymentAmount(payment) > 0;
  const close = () => {
    if (locked.current) return;
    setRemainingPaymentOpen(false);
    onClose();
  };

  useEffect(() => {
    if (!remainingPaymentOpen) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!locked.current) setRemainingPaymentOpen(false);
      return true;
    });
    return () => subscription.remove();
  }, [remainingPaymentOpen]);

  const act = async (entry: SettlementPaymentEntry, action: SettlementPaymentAction, note: string) => {
    if (locked.current || readOnly || !ready) return;
    locked.current = true;
    onBusyChange?.(true);
    setBusyPaymentId(entry.id);
    setBusyAction(action);
    try {
      if (!(await ensureOnline("Updating a payment needs an internet connection."))) return;
      const result = await services.expense.transitionSettlementPayment(entry.id, action, note);
      try { void Promise.resolve(onRefetch()).catch(console.error); } catch (cause) { console.error("Refreshing settlements:", cause); }
      locked.current = false;
      onBusyChange?.(false);
      close();
      if (!partialSettlement && action !== "confirm") {
        toast({ type: "success", description: action === "reject" ? "The payment request has been rejected."
          : action === "withdraw" ? "Your payment request has been undone."
            : "The settlement has been reopened for review." });
      } else void feedback(action === "reject" ? "payment-request-rejected"
        : action === "withdraw" ? "payment-request-withdrawn"
          : action === "reopen" ? "payment-reopened"
            : result.settled ? "settlement-completed" : "partial-payment-recorded",
        { afterNavigation: true });
    } catch (cause) {
      toast({ title: "Payment Not Updated", description: settlementErrorMessage(cause), type: "error" });
      details.refresh();
    } finally {
      locked.current = false;
      onBusyChange?.(false);
      setBusyPaymentId(null);
      setBusyAction(null);
    }
  };

  if (!partialSettlement) {
    const currentEntry = entries.find((entry) => entry.status === "requested") ??
      entries.find((entry) => entry.status === "confirmed");
    // Full payments keep the original cards and one proof image. Those values
    // now come from the current ledger entry rather than overwritten columns.
    const fullPayment: Payment = currentEntry ? {
      ...payment,
      member_note: currentEntry.member_note ?? null,
      payer_note: currentEntry.payer_note ?? null,
      proof_of_payment: currentEntry.proof_of_payment ?? null,
      requested_at: currentEntry.reopened_at ?? (currentEntry.status === "requested" || currentEntry.created_by === payment.member.id
        ? currentEntry.created_at : payment.requested_at),
      settled_at: currentEntry.status === "confirmed" ? currentEntry.confirmed_at ?? null : null
    } : payment;
    // The native route stays mounted when a cached full-payment preview becomes
    // partial after the history read. Only the content changes.
    return <VStack className="flex-1">
      <FullSettlementReview key={payment.id} onClose={close} payment={fullPayment}
        loading={loading} error={error} onRetry={details.refresh} busyAction={busyAction}
        readOnly={readOnly || !currentEntry} showGroupLink={showGroupLink}
        onAction={async (action) => { if (currentEntry) await act(currentEntry, action, ""); }} />
    </VStack>;
  }

  return (
    <VStack className="flex-1">
      <SettlementSheetPager recording={remainingPaymentOpen && canAddPayment} details={
      <VStack className="flex-1">
      <SettlementSheetHeader title="Settlement Details" onClose={close}
        groupId={payment.group_id} showGroupLink={showGroupLink && !busyPaymentId} />
      <Text className="text-sm text-secondary-950 px-4 pb-4">Track payments and the remaining balance.</Text>
      <ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled">
        <VStack className="gap-y-6 pb-6">
          <SettlementHistoryState loading={loading} error={error} onRetry={details.refresh} showProgress={(payment.confirmed_paid_amount ?? 0) > 0} />
          {!loading && !error && (
            <>
              <SettlementSummary payment={payment} />
              {(canAddPayment || (!readOnly && isRecipient)) && hasPending ? (
                <HStack className="bg-primary-50 rounded-xl gap-x-3 p-4 items-start" accessibilityRole="alert">
                  <Icon as={Info} size="lg" className="text-primary-600 dark:text-primary-800 mt-0.5 shrink-0" />
                  <VStack className="flex-1 gap-y-1">
                    <Text className="font-medium text-primary-600 dark:text-primary-800">Payment Awaiting Confirmation</Text>
                    <Text className="text-sm text-primary-600 dark:text-primary-800">
                      {isRecipient
                        ? "Confirm or reject the current request in the history below. Only the sender can record the remaining payment."
                        : "You can pay the remaining balance once your current request is confirmed, rejected, or withdrawn."}
                    </Text>
                  </VStack>
                </HStack>
              ) : canAddPayment ? (
                <FormButton text="Pay Remaining"
                  icon={<Icon as={BanknoteArrowUp} size="md" className="text-white" />}
                  disabled={busyPaymentId !== null}
                  onPress={() => setRemainingPaymentOpen(true)} />
              ) : null}
              {entries.length > 0 ? (
                <SettlementPaymentHistory payment={payment} entries={entries}
                  onAction={readOnly ? undefined : act} busyPaymentId={busyPaymentId} />
              ) : (
                <Box className="p-4 rounded-xl bg-secondary-100">
                  <Text className="text-secondary-950">No payments recorded yet.</Text>
                </Box>
              )}
            </>
          )}
        </VStack>
      </ScrollView>
      <VStack className="p-4 gap-y-2">
        <FormButton text="Close" variant="outline" disabled={busyPaymentId !== null} onPress={close} />
      </VStack>
      </VStack>
      } form={canAddPayment ? (
        <SettlementPaymentSheet isOpen={isOpen && remainingPaymentOpen} onClose={close}
          onBack={() => setRemainingPaymentOpen(false)} payment={payment}
          onBusyChange={(busy) => { locked.current = busy; onBusyChange?.(busy); }}
          onRefetch={onRefetch} showGroupLink={false} />
      ) : null} />
    </VStack>
  );
}
