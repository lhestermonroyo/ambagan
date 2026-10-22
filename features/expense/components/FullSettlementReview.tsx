import AppAvatar from "@/components/AppAvatar";
import ConfirmButton from "@/components/ConfirmButton";
import FormButton from "@/components/FormButton";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import useUserState from "@/features/user/states/user.state";
import type { Payment } from "@/types/expenses";
import type { SettlementPaymentAction } from "@/types/settlementPayments";
import { formatDate } from "@/utils/formatDate";
import { getSecondaryHex, getOnSolidHex } from "@/utils/getColorHex";
import { Image } from "expo-image";
import { CircleX, Expand, ReceiptText, Undo2 } from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { useColorScheme } from "react-native";
import ImageViewerSheet from "./ImageViewerSheet";
import SettlementHistoryState from "./SettlementHistoryState";
import SettlementSheetHeader from "./SettlementSheetHeader";
import SettlementSummary from "./SettlementSummary";
import StatusBadge from "./StatusBadge";

/** Original full-payment cards and footer, inside the caller's persistent sheet.
 * Actions still use the ledger-backed callbacks so retries remain safe. */
export default function FullSettlementReview({ onClose, payment, loading, error,
  onRetry, onAction, busyAction, readOnly = false, showGroupLink = true
}: {
  onClose: () => void;
  payment: Payment;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onAction: (action: SettlementPaymentAction) => Promise<void>;
  busyAction: SettlementPaymentAction | null;
  readOnly?: boolean;
  showGroupLink?: boolean;
}) {
  const userId = useUserState((state) => state.details?.id);
  const [viewerOpen, setViewerOpen] = useState(false);
  const colorScheme = useColorScheme() ?? "light";
  const isMemberMe = payment.member.id === userId;
  const isPayerMe = payment.payer.id === userId;
  const canAct = !readOnly && !loading && !error;
  const canReview = canAct && isPayerMe && payment.status === "requested";
  const canRevert = canAct && isPayerMe && payment.status === "settled";
  const canUndo = canAct && isMemberMe && payment.status === "requested";
  const submitting = busyAction !== null;

  const footer = (
        <Box className="items-center justify-center p-4">
          <HStack className="w-full gap-x-2">
            {canReview && (
              <>
                <ConfirmButton className="flex-1" action="negative" text="Reject"
                  confirmIcon={CircleX}
                  isDelete confirmText="Reject" loading={busyAction === "reject"} disabled={submitting}
                  onConfirm={() => onAction("reject")} confirmTitle="Reject Settlement Request"
                  confirmDescription="Are you sure you want to reject this settlement request? This will send the settlement back to pending."
                />
                <FormButton className="flex-1" text="Approve" loading={busyAction === "confirm"}
                  disabled={submitting} onPress={() => { void onAction("confirm"); }} />
              </>
            )}
            {canRevert && (
              <FormButton className="flex-1" action="negative" text="Revert"
                loading={busyAction === "reopen"} disabled={submitting}
                onPress={() => { void onAction("reopen"); }} />
            )}
            {canUndo && (
              <ConfirmButton className="flex-1" action="negative" text="Undo Request"
                confirmIcon={Undo2}
                isDelete confirmText="Undo Request" loading={busyAction === "withdraw"} disabled={submitting}
                onConfirm={() => onAction("withdraw")} confirmTitle="Undo Settlement Request"
                confirmDescription="Are you sure you want to undo your settlement request? The settlement will return to pending so you can submit it again."
              />
            )}
            {!canReview && !canRevert && !canUndo && (
              <FormButton className="flex-1" variant="outline" text="Close" disabled={submitting} onPress={onClose} />
            )}
          </HStack>
        </Box>
  );

  return (
    <>
      <VStack className="flex-1">
        <SettlementSheetHeader title="Review Settlement" onClose={onClose}
          groupId={payment.group_id} showGroupLink={showGroupLink && !submitting} />
        <ScrollView className="flex-1 px-4">
          <VStack className="gap-y-6 pb-6">
            <SettlementHistoryState loading={loading} error={error} onRetry={onRetry} variant="full" showProgress={false} />
            {!loading && !error && (
              <>
                <SettlementSummary payment={payment} confirmedPaidAmount={0} />
      
                <Box className="bg-secondary-100 rounded-xl">
                  <DetailRow
                    label="Request Date"
                    value={
                      <Text>{formatDate(payment.requested_at || "") || "N/A"}</Text>
                    }
                  />
                  <Box className="mx-4">
                    <Divider className="border-secondary-200" />
                  </Box>
                  <DetailRow
                    label="Mark Settled Date"
                    value={
                      <Text>{formatDate(payment.settled_at || "") || "N/A"}</Text>
                    }
                  />
                  {payment.rejected_at && (
                    <>
                      <Box className="mx-4">
                        <Divider className="border-secondary-200" />
                      </Box>
                      <DetailRow
                        label="Rejection Date"
                        value={<Text>{formatDate(payment.rejected_at)}</Text>}
                      />
                    </>
                  )}
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
                    label="Paid by"
                    value={
                      <HStack className="gap-x-3 items-center">
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
                    label="Paid to"
                    value={
                      <HStack className="gap-x-3 items-center">
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
                  <Box className="relative w-full bg-secondary-100 rounded-xl">
                    <Image
                      source={{ uri: payment.proof_of_payment }}
                      contentFit="contain"
                      cachePolicy="memory-disk"
                      className="aspect-square h-auto w-full rounded-xl"
                    />
                    <Button
                      className="rounded-full p-0 h-[40] w-[40] absolute bottom-4 right-4"
                      onPress={() => setViewerOpen(true)}
                    >
                      <Expand
                        size={18}
                        color={getOnSolidHex(colorScheme)}
                      />
                    </Button>
                  </Box>
                ) : (
                  <Box className="w-full aspect-square rounded-xl bg-secondary-100 items-center justify-center">
                    <VStack className="gap-y-2 items-center">
                      <ReceiptText
                        size={36}
                        color={getSecondaryHex("text-secondary-950", colorScheme)}
                      />
                      <Text className="text-sm text-secondary-950">
                        No proof of payment provided
                      </Text>
                    </VStack>
                  </Box>
                )}
              </>
            )}
          </VStack>
        </ScrollView>
        {footer}
      </VStack>
      <ImageViewerSheet isOpen={viewerOpen} onClose={() => setViewerOpen(false)}
        uri={payment.proof_of_payment ?? null} title="Proof of Payment" />
    </>
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
