import { usesPartialPaymentFlow } from "../utils/settlementPayments.util";
import MarkAsSettledSheet from "@/features/expense/components/MarkAsSettledSheet";
import RequestSettledSheet from "@/features/expense/components/RequestSettledSheet";
import ReviewRequestPaidSheet from "@/features/expense/components/ReviewRequestPaidSheet";
import useUserState from "@/features/user/states/user.state";
import { Payment, PaymentPreview } from "@/types/expenses";
import { useRouter } from "expo-router";
import { useEffect } from "react";

// Which settlement sheet a payment should open, based on the viewer's role and
// the payment status. Previously the user picked this from an intermediate
// action sheet ("Settle Up" / "View Details"); now we resolve it up front and
// open the destination sheet directly.
type SettlementSheet =
  | { kind: "request" }
  | { kind: "markSettled" }
  | { kind: "review"; isPayer: boolean; readOnly: boolean }
  | { kind: "none" };

function resolveSheet(payment: Payment, userId?: string): SettlementSheet {
  const isUserMember = payment.member.id === userId;
  const isUserPayer = payment.payer.id === userId;

  if (isUserMember) {
    if (payment.status === "pending" && !usesPartialPaymentFlow(payment)) return { kind: "request" };
    return {
      kind: "review",
      isPayer: false,
      readOnly: false
    };
  }

  if (isUserPayer) {
    if (payment.status === "pending" && !usesPartialPaymentFlow(payment)) return { kind: "markSettled" };
    return { kind: "review", isPayer: true, readOnly: false };
  }

  return { kind: "none" };
}

function SettlementContent({
  isOpen,
  onClose,
  item,
  onRefetch
}: {
  isOpen: boolean;
  onClose: () => void;
  item: PaymentPreview;
  onRefetch: () => void;
}) {
  const router = useRouter();
  const userId = useUserState((state) => state.details?.id);
  // Each destination loads a fresh parent and ledger in one snapshot. Avoid a
  // separate hydration request here that could race the payment-history read.
  const payment = item as Payment;
  const sheet = resolveSheet(payment, userId);

  // Neither payer nor ower — there's no personal action to take, so send them
  // straight to the group settlement screen (what the old sheet's only button
  // did in this case).
  useEffect(() => {
    if (isOpen && userId && sheet.kind === "none") {
      onClose();
      router.push(`/groups/${item.group_id}`);
    }
  }, [isOpen, sheet.kind, userId, onClose, router, item.group_id]);

  if (sheet.kind === "request") return (
    <RequestSettledSheet isOpen={isOpen} onClose={onClose} payment={payment} onRefetch={onRefetch} />
  );
  if (sheet.kind === "markSettled") return (
    <MarkAsSettledSheet isOpen={isOpen} onClose={onClose} payment={payment} onRefetch={onRefetch} />
  );
  if (sheet.kind === "review") return (
    <ReviewRequestPaidSheet isOpen={isOpen} onClose={onClose} payment={payment}
      onRefetch={onRefetch} isPayer={sheet.isPayer} readOnly={sheet.readOnly} />
  );
  return null;
}

export default function SettlementActionSheet({
  isOpen,
  onClose,
  item,
  onRefetch
}: {
  isOpen: boolean;
  onClose: () => void;
  item: PaymentPreview | null;
  onRefetch: () => void;
}) {
  if (!item) return null;

  return (
    <SettlementContent
      isOpen={isOpen}
      onClose={onClose}
      item={item}
      onRefetch={onRefetch}
    />
  );
}
