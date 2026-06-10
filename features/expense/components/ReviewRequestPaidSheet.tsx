import AppAvatar from "@/components/AppAvatar";
import ConfirmButton from "@/components/ConfirmButton";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Image } from "@/components/ui/image";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import useAppToast from "@/hooks/use-app-toast";
import services from "@/services";
import states from "@/states";
import { Payment } from "@/types/expenses";
import { formatDate } from "@/utils/formatDate";
import { getSecondaryHex } from "@/utils/getColorHex";
import { ReceiptText } from "lucide-react-native";
import { Fragment, ReactNode, useState } from "react";
import { useColorScheme } from "react-native";
import { formatAmount } from "../utils/formatAmount";
import StatusBadge from "./StatusBadge";

export default function ReviewRequestPaidSheet({
  isOpen,
  onClose,
  onRefetch,
  payment,
  isPayer = false,
  readOnly = false
}: {
  isOpen: boolean;
  onClose: () => void;
  onRefetch: () => void;
  payment: Payment;
  isPayer?: boolean;
  readOnly?: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);

  const { details: userDetails } = states.user();
  const toast = useAppToast();
  const colorScheme = useColorScheme() ?? "light";

  if (!payment) {
    return null;
  }

  const handleMarkAsSettled = async () => {
    setSubmitting(true);
    try {
      const response = await services.expense.markAsSettled({
        note: "",
        receipt: null,
        expenseSplitId: payment.id,
        expenseId: payment.expense_id
      });

      if (!response) {
        throw new Error("Failed to mark as paid");
      }

      onRefetch();
      onClose();
      toast({
        description: "The payment request has been settled.",
        type: "success"
      });
    } catch (error) {
      console.error("Error marking as paid:", error);
      toast({
        title: "Error",
        description:
          "There was an issue settling this request. Please try again.",
        type: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectRequest = async () => {
    setSubmitting(true);
    try {
      const response = await services.expense.rejectSettledRequest(payment.id);

      if (!response) {
        throw new Error("Failed to reject payment request");
      }

      onRefetch();
      onClose();
      toast({
        description: "The payment request has been rejected.",
        type: "success"
      });
    } catch (error) {
      console.error("Error rejecting payment request:", error);
      toast({
        title: "Error",
        description:
          "There was an issue rejecting this request. Please try again.",
        type: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUndoRequest = async () => {
    setSubmitting(true);
    try {
      const response = await services.expense.undoSettledRequest(payment.id);

      if (!response) {
        throw new Error("Failed to undo paid request");
      }

      onRefetch();
      onClose();
      toast({
        description: "Your payment request has been undone.",
        type: "success"
      });
    } catch (error) {
      console.error("Error undoing paid request:", error);
      toast({
        title: "Error",
        description:
          "There was an issue undoing your request. Please try again.",
        type: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevertSettledRequest = async () => {
    setSubmitting(true);
    try {
      const response = await services.expense.revertSettledRequest(payment.id);

      if (!response) {
        throw new Error("Failed to revert settled request");
      }

      onRefetch();
      onClose();
      toast({
        description: "The settlement has been reopened for review.",
        type: "success"
      });
    } catch (error) {
      console.error("Error reverting settled request:", error);
      toast({
        title: "Error",
        description:
          "There was an issue reverting this settlement. Please try again.",
        type: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isMemberMe = payment.member.id === userDetails?.id;
  const isPayerMe = payment.payer.id === userDetails?.id;

  return (
    <Fragment>
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
                  Review Settlement
                </Text>
              </HStack>
            </Pressable>

            <ScrollView className="flex-1 px-4">
              <VStack className="gap-y-6">
                <VStack className="flex-1">
                  <Text className="text-3xl" bold>
                    {formatAmount(payment.amount || 0, payment.currency)}
                  </Text>
                  <Text className="text-secondary-950">Amount paid</Text>
                </VStack>

                <Box className="bg-secondary-100 rounded-xl">
                  <DetailRow
                    label="Updated"
                    value={
                      <Text>
                        {formatDate(payment.status_updated_at) || "N/A"}
                      </Text>
                    }
                  />
                  <Box className="mx-4">
                    <Divider className="border-secondary-200" />
                  </Box>
                  <DetailRow
                    label="Status"
                    value={
                      <Box className="self-end">
                        <StatusBadge size="lg" status={payment.status} />
                      </Box>
                    }
                  />
                </Box>

                <Box className="bg-secondary-100 rounded-xl">
                  <DetailRow
                    label="Paid By"
                    value={
                      <HStack className="gap-x-2 items-center">
                        <AppAvatar
                          name={payment.member.first_name}
                          uri={payment.member.avatar!}
                          size="sm"
                        />
                        <Text>
                          {payment.member.first_name} {payment.member.last_name}
                          {isMemberMe && " (You)"}
                        </Text>
                      </HStack>
                    }
                  />
                  <Box className="mx-4">
                    <Divider className="border-secondary-200" />
                  </Box>
                  <DetailRow
                    label="Note"
                    value={<Text>{payment.member_note || "N/A"}</Text>}
                  />
                </Box>

                <Box className="bg-secondary-100 rounded-xl">
                  <DetailRow
                    label="Paid To"
                    value={
                      <HStack className="gap-x-2 items-center">
                        <AppAvatar
                          name={payment.payer.first_name}
                          uri={payment.payer.avatar!}
                          size="sm"
                        />
                        <Text>
                          {payment.payer.first_name} {payment.payer.last_name}
                          {isPayerMe && " (You)"}
                        </Text>
                      </HStack>
                    }
                  />
                  <Box className="mx-4">
                    <Divider className="border-secondary-200" />
                  </Box>
                  <DetailRow
                    label="Note"
                    value={<Text>{payment.payer_note || "N/A"}</Text>}
                  />
                </Box>

                {payment.proof_of_payment ? (
                  <Box className="relative w-full bg-background-100 rounded-xl">
                    <Image
                      source={{ uri: payment.proof_of_payment }}
                      alt="Receipt"
                      resizeMode="contain"
                      className="aspect-square h-auto w-full rounded-xl"
                    />
                  </Box>
                ) : (
                  <Box className="w-full aspect-square rounded-xl border border-secondary-300 items-center justify-center">
                    <VStack className="gap-y-2 items-center">
                      <ReceiptText
                        size={36}
                        color={getSecondaryHex(
                          "text-secondary-950",
                          colorScheme
                        )}
                      />
                      <Text className="text-secondary-950">
                        No proof of payment provided
                      </Text>
                    </VStack>
                  </Box>
                )}
              </VStack>
            </ScrollView>
          </VStack>
          <Box className="items-center justify-center p-4">
            <HStack className="gap-x-2">
              {!readOnly && (
                <Fragment>
                  {isPayer ? (
                    <Fragment>
                      {payment.status === "settled" ? (
                        <FormButton
                          className="flex-1"
                          action="negative"
                          text="Revert"
                          loading={submitting}
                          onPress={handleRevertSettledRequest}
                        />
                      ) : (
                        <Fragment>
                          <ConfirmButton
                            className="flex-1"
                            action="negative"
                            text="Reject"
                            loading={submitting}
                            onConfirm={handleRejectRequest}
                            confirmTitle="Reject Settlement Request"
                            confirmDescription="Are you sure you want to reject this settlement request? This will send it back to pending and remove the submitted proof of payment."
                          />
                          <FormButton
                            className="flex-1"
                            text="Approve"
                            loading={submitting}
                            onPress={handleMarkAsSettled}
                          />
                        </Fragment>
                      )}
                    </Fragment>
                  ) : (
                    payment.status !== "settled" && (
                      <ConfirmButton
                        className="flex-1"
                        action="negative"
                        text="Undo Request"
                        loading={submitting}
                        onConfirm={handleUndoRequest}
                        confirmTitle="Undo Settlement Request"
                        confirmDescription="Are you sure you want to undo your settlement request? This will change the status back to pending and remove any notes or receipt you added."
                      />
                    )
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

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <HStack className="items-start gap-x-4 justify-between p-4">
      <Box className="flex-1">
        <Text className="text-secondary-950">{label}</Text>
      </Box>
      <Box style={{ flex: 2 }} className="w-full items-end">
        {value}
      </Box>
    </HStack>
  );
}
