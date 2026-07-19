import MarkAsSettledSheet from "@/features/expense/components/MarkAsSettledSheet";
import RequestSettledSheet from "@/features/expense/components/RequestSettledSheet";
import ReviewRequestPaidSheet from "@/features/expense/components/ReviewRequestPaidSheet";
import { useNetwork } from "@/hooks/useNetwork";
import services from "@/services";
import states from "@/states";
import { Payment, PaymentPreview } from "@/types/expenses";
import { useRouter } from "expo-router";
import { Fragment, useEffect, useMemo, useState } from "react";

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
    if (payment.status === "pending") return { kind: "request" };
    return {
      kind: "review",
      isPayer: false,
      readOnly: payment.status === "settled"
    };
  }

  if (isUserPayer) {
    if (payment.status === "pending") return { kind: "markSettled" };
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
  const { details: userDetails } = states.user();
  const { isOnline } = useNetwork();

  if (!userDetails) return null;

  // The home Recent Activity feed supplies a PaymentPreview (via
  // getPaymentsByUserId), which omits proof_of_payment / notes /
  // status_updated_at. The settlement sheets below display those, so hydrate the
  // preview into a full Payment once the sheet opens.
  const [fullPayment, setFullPayment] = useState<Payment | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFullPayment(null);

    // Fast path: the home feed now selects proof_of_payment (and notes), so a
    // preview that already carries it needs no round-trip. `undefined` means the
    // field wasn't selected (older/offline preview) — only then do we fetch, and
    // only when online (offline we view the cached preview as-is).
    if (isOnline && isOpen && item?.id && item.proof_of_payment === undefined) {
      services.expense
        .getPaymentById(item.id)
        .then((full) => {
          if (!cancelled && full) setFullPayment(full);
        })
        .catch((error) =>
          console.error("Error hydrating payment details:", error)
        );
    }

    return () => {
      cancelled = true;
    };
  }, [isOpen, item?.id, isOnline]);

  const payment = fullPayment ?? (item as Payment);
  const sheet = useMemo(
    () => resolveSheet(payment, userDetails?.id),
    [payment, userDetails?.id]
  );

  // Neither payer nor ower — there's no personal action to take, so send them
  // straight to the group settlement screen (what the old sheet's only button
  // did in this case).
  useEffect(() => {
    if (isOpen && userDetails?.id && sheet.kind === "none") {
      onClose();
      router.push(`/groups/${item.group_id}`);
    }
  }, [isOpen, sheet.kind, userDetails?.id]);

  return (
    <Fragment>
      <RequestSettledSheet
        isOpen={isOpen && sheet.kind === "request"}
        onClose={onClose}
        payment={payment}
        onRefetch={onRefetch}
      />
      <MarkAsSettledSheet
        isOpen={isOpen && sheet.kind === "markSettled"}
        onClose={onClose}
        payment={payment}
        onRefetch={onRefetch}
      />
      <ReviewRequestPaidSheet
        isOpen={isOpen && sheet.kind === "review"}
        onClose={onClose}
        payment={payment}
        onRefetch={onRefetch}
        isPayer={sheet.kind === "review" ? sheet.isPayer : false}
        readOnly={sheet.kind === "review" ? sheet.readOnly : false}
      />
    </Fragment>
  );
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
