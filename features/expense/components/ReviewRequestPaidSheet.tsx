import ConfirmButton from "@/components/ConfirmButton";
import FormButton from "@/components/FormButton";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Image } from "@/components/ui/image";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import useAppToast from "@/hooks/use-app-toast";
import services from "@/services";
import { ExpenseSplit } from "@/types/expenses";
import { Fragment, useState } from "react";
import { formatAmount } from "../utils/formatAmount";

export default function ReviewRequestPaidSheet({
  isOpen,
  onClose,
  onRefetch,
  expenseSplit,
  isPayer = false
}: {
  isOpen: boolean;
  onClose: () => void;
  onRefetch: () => void;
  expenseSplit: ExpenseSplit;
  isPayer?: boolean;
}) {
  if (!expenseSplit) {
    return null;
  }

  const [submitting, setSubmitting] = useState(false);

  const showToast = useAppToast();

  const handleMarkAsPaid = async () => {
    setSubmitting(true);
    try {
      const response = await services.expense.markAsPaid({
        note: "",
        receipt: null,
        expenseSplitId: expenseSplit.id
      });

      if (!response) {
        throw new Error("Failed to mark as paid");
      }

      onRefetch();
      onClose();
      showToast("Success", "The request has been marked as paid.", "success");
    } catch (error) {
      console.error("Error marking as paid:", error);
      showToast(
        "Error",
        "There was an issue marking the request as paid. Please try again.",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleUndoRequest = async () => {
    setSubmitting(true);
    try {
      const response = await services.expense.undoPaidRequest(expenseSplit.id);

      if (!response) {
        throw new Error("Failed to undo paid request");
      }

      onRefetch();
      onClose();
      showToast("Success", "Your paid request has been undone.", "success");
    } catch (error) {
      console.error("Error undoing paid request:", error);
      showToast(
        "Error",
        "There was an issue undoing your request. Please try again.",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Fragment>
      <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[80]}>
        <ActionsheetBackdrop />
        <ActionsheetContent className="p-0">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <VStack className="w-full p-4 flex-1 gap-6">
            <Text bold className="text-xl">
              {isPayer ? "Paid Request Details" : "Review Paid Request"}
            </Text>
            <ScrollView className="flex-1" bounces={false}>
              <VStack className="gap-y-6">
                <VStack className="flex-1">
                  <Text className="text-2xl" bold>
                    {formatAmount(expenseSplit.amount || 0)}
                  </Text>
                  <Text className="text-secondary-950 text-sm">
                    {isPayer ? "Amount paid" : "You paid"}
                  </Text>
                </VStack>

                {expenseSplit.note && (
                  <VStack>
                    <Text className="text-lg">
                      {expenseSplit.note || "No additional notes provided."}
                    </Text>
                    <Text className="text-secondary-950 text-sm">Note</Text>
                  </VStack>
                )}

                {expenseSplit.payer_note && (
                  <VStack>
                    <Text className="text-lg">
                      {expenseSplit.payer_note ||
                        "No additional notes provided."}
                    </Text>
                    <Text className="text-secondary-950 text-sm">
                      Payer's Note
                    </Text>
                  </VStack>
                )}

                {expenseSplit.receipt ? (
                  <Box className="relative w-full bg-background-100 rounded-3xl">
                    <Image
                      source={{ uri: expenseSplit.receipt }}
                      alt="Receipt"
                      resizeMode="contain"
                      className="aspect-square h-auto w-full rounded-3xl"
                    />
                  </Box>
                ) : (
                  <Box className="w-full aspect-square rounded border border-secondary-300 items-center justify-center">
                    <Text className="text-secondary-950">
                      No receipt provided
                    </Text>
                  </Box>
                )}
              </VStack>
            </ScrollView>
          </VStack>
          <Box className="items-center justify-start sticky bottom-0 px-4">
            <Box className="h-4" />
            <HStack className="gap-x-2 pt-4">
              <FormButton
                className="flex-1"
                variant="outline"
                text="Cancel"
                disabled={submitting}
                onPress={onClose}
              />
              {expenseSplit.status !== "paid" && (
                <Fragment>
                  {isPayer ? (
                    <ConfirmButton
                      className="flex-1"
                      text="Mark as Paid"
                      loading={submitting}
                      onConfirm={handleMarkAsPaid}
                      confirmTitle="Mark as Paid"
                      confirmDescription="Are you sure you want to mark this request as paid? This will notify the requester that you have paid and update the status of this split."
                    />
                  ) : (
                    <ConfirmButton
                      className="flex-1"
                      action="negative"
                      text="Undo Request"
                      loading={submitting}
                      onConfirm={handleUndoRequest}
                      confirmTitle="Undo Request"
                      confirmDescription="Are you sure you want to undo your request? This will change the status back to pending and remove any notes or receipt you added."
                    />
                  )}
                </Fragment>
              )}
            </HStack>
          </Box>
        </ActionsheetContent>
      </Actionsheet>
    </Fragment>
  );
}
