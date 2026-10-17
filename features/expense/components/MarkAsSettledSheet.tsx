import FormButton from "@/components/FormButton";
import FormTextarea from "@/components/FormTextarea";
import AppSheet from "@/components/AppSheet";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import UploadImage from "@/components/UploadImage";
import useAppToast from "@/hooks/use-app-toast";
import { useActionFeedback } from "@/hooks/useActionFeedback";
import { useEnsureOnline } from "@/hooks/useEnsureOnline";
import services from "@/services";
import { Payment } from "@/types/expenses";
import { formatDate } from "@/utils/formatDate";
import { ImagePickerSuccessResult } from "expo-image-picker";
import { useState } from "react";
import SettlementSheetHeader from "./SettlementSheetHeader";
import SettlementSummary from "./SettlementSummary";

export default function MarkAsSettledSheet({
  isOpen,
  onClose,
  payment,
  onRefetch,
  showGroupLink = true,
}: {
  isOpen: boolean;
  onClose: () => void;
  payment: Payment;
  onRefetch: () => void;
  showGroupLink?: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState({
    note: "Payment acknowledged! 😊",
    receipt: null as ImagePickerSuccessResult | null,
  });

  const toast = useAppToast();
  const showFeedback = useActionFeedback();
  const ensureOnline = useEnsureOnline();

  if (!payment) {
    return null;
  }

  const handleSubmit = async () => {
    if (
      !(await ensureOnline("Settling an expense needs an internet connection."))
    )
      return;
    setSubmitting(true);
    let completed = false;

    try {
      const response = await services.expense.markAsSettled({
        note: values.note,
        receipt: values.receipt,
        expenseSplitId: payment.id,
        expenseId: payment.expense_id,
      });

      if (!response) {
        throw new Error("Failed to mark as settled");
      }

      onRefetch();
      completed = true;
    } catch (error) {
      console.error("Error marking as settled:", error);
      toast({
        title: "Error",
        description:
          "There was an issue marking this payment as settled. Please try again.",
        type: "error",
      });
    } finally {
      setSubmitting(false);
      onClose();
      if (completed) void showFeedback("settlement-completed");
    }
  };

  return (
    <AppSheet
      isOpen={isOpen}
      onClose={onClose}
      keyboardAvoiding
      footer={
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
      }
    >
      <SettlementSheetHeader
        title="Mark as Settled"
        onClose={onClose}
        groupId={payment.group_id}
        showGroupLink={showGroupLink}
      />

      <ScrollView className="flex-1 px-4">
        <VStack className="gap-y-6">
          <SettlementSummary payment={payment} />

          {payment.rejected_at && (
            <VStack className="bg-secondary-100 rounded-xl p-4 gap-y-1">
              <Text bold className="text-error-500">
                Previously rejected
              </Text>
              <Text className="text-sm text-secondary-950">
                You rejected the last request on{" "}
                {formatDate(payment.rejected_at)}.
              </Text>
            </VStack>
          )}

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
              onSelect={(result) => setValues({ ...values, receipt: result })}
            />
            <Text className="text-secondary-950 text-sm">
              A receipt photo, payment screenshot, or any proof of the payment.
            </Text>
          </VStack>
        </VStack>
      </ScrollView>
    </AppSheet>
  );
}
