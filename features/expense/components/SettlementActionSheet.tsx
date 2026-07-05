import FormButton from "@/components/FormButton";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { VStack } from "@/components/ui/vstack";
import MarkAsSettledSheet from "@/features/expense/components/MarkAsSettledSheet";
import RequestSettledSheet from "@/features/expense/components/RequestSettledSheet";
import ReviewRequestPaidSheet from "@/features/expense/components/ReviewRequestPaidSheet";
import services from "@/services";
import states from "@/states";
import { Payment, PaymentPreview } from "@/types/expenses";
import { useRouter } from "expo-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import SettlementItem from "./SettlementItem";

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
  const [requestSheetOpen, setRequestSheetOpen] = useState(false);
  const [markAsSettledSheetOpen, setMarkAsSettledSheetOpen] = useState(false);
  const [reviewSheetOpen, setReviewSheetOpen] = useState(false);
  const [reviewIsPayer, setReviewIsPayer] = useState(false);
  const [reviewReadOnly, setReviewReadOnly] = useState(false);

  const router = useRouter();

  const { details: userDetails } = states.user();

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
    // field wasn't selected (older/offline preview) — only then do we fetch.
    if (isOpen && item?.id && item.proof_of_payment === undefined) {
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
  }, [isOpen, item?.id]);

  const payment = fullPayment ?? (item as Payment);
  const isUserMember = payment.member.id === userDetails?.id;
  const isUserPayer = payment.payer.id === userDetails?.id;

  const getActionConfig = (): { label: string; onPress: () => void } | null => {
    if (isUserMember) {
      if (item.status === "pending") {
        return {
          label: "Settle Up",
          onPress: () => {
            onClose();
            setRequestSheetOpen(true);
          }
        };
      }
      return {
        label: "View Details",
        onPress: () => {
          onClose();
          setReviewIsPayer(false);
          setReviewReadOnly(item.status === "settled");
          setReviewSheetOpen(true);
        }
      };
    }

    if (isUserPayer) {
      if (item.status === "pending") {
        return {
          label: "Settle Up",
          onPress: () => {
            onClose();
            setMarkAsSettledSheetOpen(true);
          }
        };
      }
      return {
        label: "View Details",
        onPress: () => {
          onClose();
          setReviewIsPayer(true);
          setReviewReadOnly(false);
          setReviewSheetOpen(true);
        }
      };
    }

    return null;
  };

  const actionConfig = useMemo(() => getActionConfig(), [item, userDetails]);

  return (
    <Fragment>
      <Actionsheet isOpen={isOpen} onClose={onClose}>
        <ActionsheetBackdrop />
        <ActionsheetContent className="p-0">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>

          <VStack className="w-full gap-y-8">
            <SettlementItem item={payment} />

            <VStack className="gap-y-2 px-4 pb-4">
              <FormButton
                variant="outline"
                text="Open Group Settlement"
                onPress={() => {
                  onClose();
                  router.push(`/groups/${item.group_id}`);
                }}
              />
              {actionConfig && (
                <FormButton
                  text={actionConfig.label}
                  onPress={actionConfig.onPress}
                />
              )}
            </VStack>
          </VStack>
        </ActionsheetContent>
      </Actionsheet>

      <RequestSettledSheet
        isOpen={requestSheetOpen}
        onClose={() => setRequestSheetOpen(false)}
        payment={payment}
        onRefetch={onRefetch}
      />
      <MarkAsSettledSheet
        isOpen={markAsSettledSheetOpen}
        onClose={() => setMarkAsSettledSheetOpen(false)}
        payment={payment}
        onRefetch={onRefetch}
      />
      <ReviewRequestPaidSheet
        isOpen={reviewSheetOpen}
        onClose={() => setReviewSheetOpen(false)}
        payment={payment}
        onRefetch={onRefetch}
        isPayer={reviewIsPayer}
        readOnly={reviewReadOnly}
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
