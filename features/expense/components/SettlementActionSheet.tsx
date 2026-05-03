import FormButton from "@/components/FormButton";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { Avatar } from "@/components/ui/avatar";
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
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { useRouter } from "expo-router";
import { BanknoteArrowDown, BanknoteArrowUp } from "lucide-react-native";
import { Fragment, useState } from "react";

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
  const [requestSheetOpen, setRequestSheetOpen] = useState(false);
  const [markAsSettledSheetOpen, setMarkAsSettledSheetOpen] = useState(false);
  const [reviewSheetOpen, setReviewSheetOpen] = useState(false);
  const [reviewIsPayer, setReviewIsPayer] = useState(false);
  const [reviewReadOnly, setReviewReadOnly] = useState(false);

  const { details: userDetails } = states.user.getState();
  const router = useRouter();

  if (!item) return null;

  const isUserMember = item.member.id === userDetails?.id;
  const isUserPayer = item.payer.id === userDetails?.id;
  const payment = item as Payment;

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

  const actionConfig = getActionConfig();

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
                <Avatar
                  size="sm"
                  className={cn(
                    isUserPayer ? "bg-success-400" : "bg-error-400"
                  )}
                >
                  {isUserPayer ? (
                    <BanknoteArrowDown size={16} color="#FFFFFF" />
                  ) : (
                    <BanknoteArrowUp size={16} color="#FFFFFF" />
                  )}
                </Avatar>
                <VStack className="gap-y-2 flex-1">
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
                        <Text className="text-lg">
                          {formatAmount(item.amount)}
                        </Text>
                        <StatusBadge status={item.status} size="lg" />
                      </VStack>
                    </HStack>
                  </HStack>
                </VStack>
              </HStack>
            </VStack>

            <VStack className="gap-y-2">
              <FormButton
                variant="outline"
                text="Expense Details"
                onPress={() => {
                  onClose();
                  router.push(`/groups/${item.group_id}/${item.expense_id}`);
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
