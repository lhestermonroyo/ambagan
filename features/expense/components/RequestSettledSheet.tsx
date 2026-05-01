import AppAvatar from "@/components/AppAvatar";
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
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText
} from "@/components/ui/form-control";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import UploadImage from "@/components/UploadImage";
import useAppToast from "@/hooks/use-app-toast";
import services from "@/services";
import { Payment } from "@/types/expenses";
import { ImagePickerSuccessResult } from "expo-image-picker";
import { useState } from "react";
import { formatAmount } from "../utils/formatAmount";

export default function RequestSettledSheet({
  isOpen,
  onClose,
  payment,
  onRefetch
}: {
  isOpen: boolean;
  onClose: () => void;
  payment: Payment;
  onRefetch: () => void;
}) {
  if (!payment) {
    return null;
  }

  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState({
    note: "Paid with thanks! 😊",
    receipt: null as ImagePickerSuccessResult | null
  });

  const toast = useAppToast();

  const handleSubmit = async () => {
    setSubmitting(true);

    try {
      const response = await services.expense.createSettledRequest({
        note: values.note,
        receipt: values.receipt,
        expenseSplitId: payment.id
      });

      if (!response) {
        throw new Error("Failed to create paid request");
      }

      onRefetch();
      toast({
        title: "Request Sent",
        description: "Your request to mark this payment as paid has been sent.",
        type: "success"
      });
    } catch (error) {
      console.error("Error creating paid request:", error);
      toast({
        title: "Error",
        description:
          "There was an issue sending your request. Please try again.",
        type: "error"
      });
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
        <VStack className="w-full flex-1">
          <VStack className="p-4">
            <Text bold className="text-xl">
              Request as Settled
            </Text>
          </VStack>
          <ScrollView className="flex-1 px-4" bounces={false}>
            <VStack className="gap-y-6">
              <VStack className="flex-1">
                <Text className="text-3xl" bold>
                  {formatAmount(payment.amount || 0)}
                </Text>
                <Text className="text-secondary-950">Amount settled</Text>
              </VStack>

              <FormControl size="md">
                <VStack className="gap-y-1">
                  <FormControlLabel>
                    <FormControlLabelText>Paid to</FormControlLabelText>
                  </FormControlLabel>
                  <HStack className="gap-x-2 items-center flex-1">
                    <AppAvatar
                      name={payment.payer.first_name}
                      uri={payment.payer.avatar!}
                      size="md"
                    />
                    <VStack>
                      <HStack className="gap-x-1 items-center">
                        <Text className="text-lg">
                          {payment.payer.first_name} {payment.payer.last_name}
                        </Text>
                      </HStack>
                      <Text className="text-secondary-950">
                        {payment.payer.email}
                      </Text>
                    </VStack>
                  </HStack>
                </VStack>
              </FormControl>

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
        <Box className="items-center justify-center p-4">
          <HStack className="gap-x-2">
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
