import useUserState from "@/features/user/states/user.state";
import type { Payment, PaymentPreview } from "@/types/expenses";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { usesPartialPaymentFlow } from "../utils/settlementPayments.util";
import MarkAsSettledSheet from "./MarkAsSettledSheet";
import RequestSettledSheet from "./RequestSettledSheet";
import ReviewRequestPaidSheet from "./ReviewRequestPaidSheet";

export function resolveSettlementScreen(payment: PaymentPreview, userId?: string) {
  if (payment.member.id === userId) {
    return payment.status === "pending" && !usesPartialPaymentFlow(payment)
      ? "request" : "review";
  }
  if (payment.payer.id === userId) {
    return payment.status === "pending" && !usesPartialPaymentFlow(payment)
      ? "markSettled" : "review";
  }
  return "group";
}

/** Content only: the root native route owns presentation for every flow. */
export default function SettlementScreenContent({ payment: preview, onClose, onRefetch,
  onBusyChange, showGroupLink
}: {
  payment: PaymentPreview;
  onClose: () => void;
  onRefetch: () => void;
  onBusyChange: (busy: boolean) => void;
  showGroupLink: boolean;
}) {
  const router = useRouter();
  const userId = useUserState((state) => state.details?.id ?? state.session?.user.id);
  const payment = preview as Payment;
  const screen = resolveSettlementScreen(payment, userId);

  useEffect(() => {
    if (userId && screen === "group") router.dismissTo(`/groups/${payment.group_id}`);
  }, [screen, userId, payment.group_id, router]);

  const props = { isOpen: true, onClose, payment, onRefetch, onBusyChange, showGroupLink };
  if (screen === "request") return <RequestSettledSheet {...props} />;
  if (screen === "markSettled") return <MarkAsSettledSheet {...props} />;
  if (screen === "review") return <ReviewRequestPaidSheet {...props} />;
  return null;
}
