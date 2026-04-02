import FormButton from "@/components/FormButton";
import FormTextarea from "@/components/FormTextarea";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import UploadImage from "@/components/UploadImage";
import useAppToast from "@/hooks/use-app-toast";
import services from "@/services";
import { ExpenseSplit } from "@/types/expenses";
import { ImagePickerSuccessResult } from "expo-image-picker";
import { useState } from "react";
import { formatAmount } from "../utils/formatAmount";

export default function RequestPaidSheet({
  isOpen,
  onClose,
  expenseSplit,
  onRefetch
}: {
  isOpen: boolean;
  onClose: () => void;
  expenseSplit: ExpenseSplit;
  onRefetch: () => void;
}) {
  if (!expenseSplit) {
    return null;
  }

  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState({
    note: "Paid with thanks! 😊",
    receipt: null as ImagePickerSuccessResult | null
  });

  const showToast = useAppToast();

  const handleSubmit = async () => {
    setSubmitting(true);

    try {
      const response = await services.expense.createPaidRequest({
        note: values.note,
        receipt: values.receipt,
        expenseSplitId: expenseSplit.id
      });

      if (!response) {
        throw new Error("Failed to create paid request");
      }

      onRefetch();
      showToast(
        "Request Sent",
        "Your request to mark this expense as paid has been sent.",
        "success"
      );
    } catch (error) {
      console.error("Error creating paid request:", error);
      showToast(
        "Error",
        "There was an issue sending your request. Please try again.",
        "error"
      );
    } finally {
      setSubmitting(false);
      onClose();
    }
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[80]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full p-4 flex-1 gap-6">
          <Text bold className="text-xl">
            Request as Paid
          </Text>
          <ScrollView className="flex-1" bounces={false}>
            <VStack className="gap-y-6">
              <VStack className="flex-1">
                <Text className="text-2xl" bold>
                  {formatAmount(expenseSplit.amount || 0)}
                </Text>
                <Text className="text-secondary-950 text-sm">Amount paid</Text>
              </VStack>

              <FormTextarea
                label="Note (optional)"
                placeholder="Enter note (e.g., Paid with thanks! 😊)"
                value={values.note}
                onChangeText={(text) => setValues({ ...values, note: text })}
                autoCapitalize="none"
              />

              <VStack className="gap-y-1">
                <UploadImage
                  title="Upload Proof of Payment (optional)"
                  onSelect={(result) =>
                    setValues({ ...values, receipt: result })
                  }
                />
                <Text className="text-secondary-950 text-sm">
                  Proof could be a photo of receipt, screenshot of online
                  payment, or any document that shows the expense details.
                </Text>
              </VStack>
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
            <FormButton
              className="flex-1"
              text="Confirm Request"
              loading={submitting}
              onPress={handleSubmit}
            />
          </HStack>
        </Box>
      </ActionsheetContent>
    </Actionsheet>
  );
}
