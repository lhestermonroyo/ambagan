import AppAvatar from "@/components/AppAvatar";
import FormButton from "@/components/FormButton";
import FormTextarea from "@/components/FormTextarea";
import Icon from "@/components/Icon";
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
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import UploadImage from "@/components/UploadImage";
import useAppToast from "@/hooks/use-app-toast";
import { useEnsureOnline } from "@/hooks/useEnsureOnline";
import services from "@/services";
import states from "@/states";
import { Payment } from "@/types/expenses";
import { ImagePickerSuccessResult } from "expo-image-picker";
import { useState } from "react";
import { useColorScheme } from "react-native";
import { formatAmount } from "../utils/formatAmount";

export default function MarkAsSettledSheet({
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
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState({
    note: "Payment acknowledged! 😊",
    receipt: null as ImagePickerSuccessResult | null
  });

  const { details: userDetails } = states.user();
  const toast = useAppToast();
  const ensureOnline = useEnsureOnline();
  const colorScheme = useColorScheme() ?? "light";

  if (!payment) {
    return null;
  }

  const isMe = payment.member.id === userDetails?.id;

  const handleSubmit = async () => {
    if (
      !(await ensureOnline("Settling an expense needs an internet connection."))
    )
      return;
    setSubmitting(true);

    try {
      const response = await services.expense.markAsSettled({
        note: values.note,
        receipt: values.receipt,
        expenseSplitId: payment.id,
        expenseId: payment.expense_id
      });

      if (!response) {
        throw new Error("Failed to mark as settled");
      }

      onRefetch();
      toast({
        title: "Marked as Settled",
        description: "This payment has been successfully marked as settled.",
        type: "success"
      });
    } catch (error) {
      console.error("Error marking as settled:", error);
      toast({
        title: "Error",
        description:
          "There was an issue marking this payment as settled. Please try again.",
        type: "error"
      });
    } finally {
      setSubmitting(false);
      onClose();
    }
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[90]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full flex-1">
          <Pressable onPress={onClose}>
            <HStack className="p-4 items-center">
              <Icon as="arrow-back-ios" className="text-secondary-950" />

              <Text bold className="text-xl">
                Mark as Settled
              </Text>
            </HStack>
          </Pressable>

          <ScrollView className="flex-1 px-4">
            <VStack className="gap-y-6">
              <VStack className="gap-y-1">
                {payment.expense_description && (
                  <Text
                    className="text-sm text-secondary-950 uppercase flex-1"
                    bold
                    numberOfLines={1}
                  >
                    {payment.expense_description}
                  </Text>
                )}
                <VStack>
                  <Text className="text-3xl" bold>
                    {formatAmount(payment.amount || 0, payment.currency)}
                  </Text>
                  <Text className="text-secondary-950">You receive</Text>
                </VStack>
              </VStack>

              <FormControl size="md">
                <VStack className="gap-y-1">
                  <FormControlLabel className="flex-1">
                    <FormControlLabelText>Paid by</FormControlLabelText>
                  </FormControlLabel>
                  <HStack className="gap-x-2 items-center flex-1">
                    <AppAvatar
                      name={payment.member.first_name}
                      uri={payment.member.avatar!}
                      size="md"
                    />
                    <VStack>
                      <HStack className="gap-x-1 items-center">
                        <Text className="text-lg">
                          {payment.member.first_name} {payment.member.last_name}
                          {isMe && " (You)"}
                        </Text>
                      </HStack>
                      <Text className="text-sm text-secondary-950">
                        {payment.member.email}
                      </Text>
                    </VStack>
                  </HStack>
                </VStack>
              </FormControl>

              <FormTextarea
                label="Note (optional)"
                placeholder="Enter note (e.g., Payment acknowledged! 😊)"
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
              text="Mark Settled"
              loading={submitting}
              onPress={handleSubmit}
            />
          </HStack>
        </Box>
      </ActionsheetContent>
    </Actionsheet>
  );
}
