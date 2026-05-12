import FormButton from "@/components/FormButton";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import MarkAsSettledSheet from "@/features/expense/components/MarkAsSettledSheet";
import RequestSettledSheet from "@/features/expense/components/RequestSettledSheet";
import ReviewRequestPaidSheet from "@/features/expense/components/ReviewRequestPaidSheet";
import StatusBadge from "@/features/expense/components/StatusBadge";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import states from "@/states";
import { Payment, PaymentPreview } from "@/types/expenses";
import { formatDate } from "@/utils/formatDate";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { useRouter } from "expo-router";
import { Fragment, useMemo, useState } from "react";
import SettlementAvatar from "./SettlementAvatar";

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

  const payment = item as Payment;
  const isUserMember = payment.member.id === userDetails?.id;
  const isUserPayer = payment.payer.id === userDetails?.id;

  const getActionConfig = (): { label: string; onPress: () => void } | null => {
    if (isUserMember) {
      if (item.status === "pending") {
        return {
          label: "Request as Settled",
          onPress: () => {
            onClose();
            setRequestSheetOpen(true);
          }
        };
      }
      return {
        label: item.status === "settled" ? "View Settlement" : "View Request",
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
          label: "Mark as Settled",
          onPress: () => {
            onClose();
            setMarkAsSettledSheetOpen(true);
          }
        };
      }
      return {
        label:
          item.status === "settled" ? "View Settlement" : "Review Settlement",
        onPress: () => {
          onClose();
          setReviewIsPayer(true);
          setReviewReadOnly(item.status === "settled");
          setReviewSheetOpen(true);
        }
      };
    }

    return null;
  };

  const actionConfig = useMemo(() => getActionConfig(), [item, userDetails]);

  return (
    <Fragment>
      <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[30]}>
        <ActionsheetBackdrop />
        <ActionsheetContent className="p-0">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>

          <VStack className="w-full h-full gap-y-4 p-4">
            <VStack className="flex-1">
              <HStack className="gap-x-2 items-start">
                <SettlementAvatar isPayer={isUserPayer} />
                <VStack className="gap-y-2 flex-1">
                  {item.expense_description && (
                    <HStack className="gap-x-4 items-center">
                      <Text
                        className="text-secondary-950 flex-1"
                        numberOfLines={1}
                      >
                        {item.expense_description}
                      </Text>
                      <Text className="text-secondary-950">
                        {formatDate(item.created_at)}
                      </Text>
                    </HStack>
                  )}
                  <HStack className="gap-x-4">
                    <VStack className="flex-1">
                      <Text className="text-lg">
                        {item.member.first_name} {item.member.last_name}
                        {isUserMember && " (You)"}
                      </Text>
                      <Text className="text-sm text-secondary-950">pays</Text>
                      <Text className="text-lg">
                        {item.payer.first_name} {item.payer.last_name}
                        {isUserPayer && " (You)"}
                      </Text>
                    </VStack>
                    <HStack className="gap-x-2 items-center">
                      <VStack className="items-end">
                        <Text
                          className={cn(
                            "text-lg",
                            isUserMember ? "text-error-400" : undefined
                          )}
                        >
                          {isUserMember && "-"}
                          {formatAmount(item.amount, item.currency)}
                        </Text>
                        <StatusBadge status={item.status} size="md" />
                      </VStack>
                    </HStack>
                  </HStack>
                </VStack>
              </HStack>
            </VStack>

            <VStack className="gap-y-2">
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
