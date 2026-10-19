import {
  Accordion,
  AccordionContent,
  AccordionHeader,
  AccordionIcon,
  AccordionItem,
  AccordionTitleText,
  AccordionTrigger
} from "@/components/ui/accordion";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import useUserState from "@/features/user/states/user.state";
import type { Payment } from "@/types/expenses";
import type { SettlementPaymentAction, SettlementPaymentEntry } from "@/types/settlementPayments";
import { format } from "date-fns";
import { ChevronDown, ChevronUp, Expand, ReceiptText } from "lucide-react-native";
import { useState } from "react";
import FormButton from "@/components/FormButton";
import ConfirmButton from "@/components/ConfirmButton";
import FormTextarea from "@/components/FormTextarea";
import { formatAmount } from "../utils/formatAmount";
import ImageViewerSheet from "./ImageViewerSheet";
import StatusBadge from "./StatusBadge";

type HistoryProps = {
  payment: Pick<Payment, "id" | "currency" | "member" | "payer">;
  entries: readonly SettlementPaymentEntry[];
  onAction?: (entry: SettlementPaymentEntry, action: SettlementPaymentAction, note: string) => Promise<void>;
  busyPaymentId?: string | null;
};

export default function SettlementPaymentHistory(props: HistoryProps) {
  if (props.entries.length === 0) return null;
  // Reset the expanded item and photo viewer when a different settlement opens.
  return <PaymentHistoryContent key={props.payment.id} {...props} />;
}

function PaymentHistoryContent({ payment, entries, onAction, busyPaymentId }: HistoryProps) {
  const userId = useUserState((state) => state.details?.id);
  const [expanded, setExpanded] = useState<string[]>(() => {
    const pending = entries.find((entry) => entry.status === "requested");
    return pending ? [pending.id] : [];
  });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [proofUri, setProofUri] = useState<string | null>(null);
  const newestFirst = [...entries].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const memberIsYou = payment.member.id === userId;
  const payerIsYou = payment.payer.id === userId;
  const hasPending = entries.some((entry) => entry.status === "requested");

  return (
    <>
      <VStack className="gap-y-3">
        <Text className="text-lg font-medium" accessibilityRole="header">
          Payment History ({entries.length})
        </Text>
        <Text className="text-sm text-secondary-950">
          Only confirmed payments reduce the balance.
        </Text>
        <Box className="rounded-xl bg-secondary-100 overflow-hidden">
          <Accordion
            key={payment.id}
            variant="unfilled"
            type="single"
            isCollapsible
            value={expanded}
            onValueChange={setExpanded}
          >
            {newestFirst.map((entry, index) => (
              <AccordionItem key={entry.id} value={entry.id}>
                <AccordionHeader>
                  <AccordionTrigger className="gap-x-3 py-4">
                    {({ isExpanded }: { isExpanded: boolean }) => (
                      <>
                        <VStack className="flex-1 min-w-0 gap-y-1">
                          <AccordionTitleText
                            className="flex-none text-lg font-medium"
                            style={{ fontFamily: "GoogleSans-Medium" }}
                          >
                            {formatAmount(entry.amount, payment.currency)}
                          </AccordionTitleText>
                          <Text className="text-sm text-secondary-950">
                            {historyDate(entry.created_at, true)}
                          </Text>
                        </VStack>
                        <HStack className="self-center shrink-0">
                          <StatusBadge status={entry.status} size="md" />
                        </HStack>
                        <AccordionIcon
                          as={isExpanded ? ChevronUp : ChevronDown}
                          className="text-secondary-950"
                        />
                      </>
                    )}
                  </AccordionTrigger>
                </AccordionHeader>
                <AccordionContent className="pt-0 pb-4">
                  {/* Mount details and proof controls only for the open item. */}
                  {expanded.includes(entry.id) && (
                    <VStack className="gap-y-4">
                      <Divider className="border-secondary-200" />
                      {(entry.status === "rejected" ||
                        entry.status === "withdrawn") && (
                        <Text className="text-sm text-secondary-950">
                          This amount is not included in the paid total.
                        </Text>
                      )}
                      {entry.confirmed_at && entry.status === "confirmed" && (
                        <HistoryDetail
                          label={payerIsYou
                            ? "Confirmed by You"
                            : `Confirmed by ${payment.payer.first_name}`}
                          value={historyDate(entry.confirmed_at)}
                        />
                      )}
                      {entry.reopened_at && (
                        <HistoryDetail
                          label="Reopened for Review"
                          value={historyDate(entry.reopened_at)}
                        />
                      )}
                      {entry.rejected_at && entry.status === "rejected" && (
                        <HistoryDetail
                          label="Rejected on"
                          value={historyDate(entry.rejected_at)}
                        />
                      )}
                      {entry.withdrawn_at && entry.status === "withdrawn" && (
                        <HistoryDetail
                          label="Withdrawn on"
                          value={historyDate(entry.withdrawn_at)}
                        />
                      )}
                      {!!entry.member_note && (
                        <HistoryNote
                          label={memberIsYou
                            ? "Your Note"
                            : `${payment.member.first_name}’s Note`}
                          note={entry.member_note}
                        />
                      )}
                      {!!entry.payer_note && (
                        <HistoryNote
                          label={payerIsYou
                            ? "Your Note"
                            : `${payment.payer.first_name}’s Note`}
                          note={entry.payer_note}
                        />
                      )}
                      {entry.proof_of_payment ? (
                        <Pressable
                          onPress={() => setProofUri(entry.proof_of_payment ?? null)}
                          accessibilityRole="button"
                          accessibilityLabel={`View proof for ${formatAmount(entry.amount, payment.currency)} payment on ${historyDate(entry.created_at)}`}
                          className="rounded-xl bg-background-0 p-3 active:opacity-70"
                        >
                          <HStack className="items-center gap-x-3">
                            <Box className="rounded-lg bg-primary-50 p-2">
                              <Icon
                                as={ReceiptText}
                                className="text-primary-700 dark:text-primary-800"
                              />
                            </Box>
                            <Text className="flex-1 text-sm text-primary-700 dark:text-primary-800">
                              View Proof of Payment
                            </Text>
                            <Icon
                              as={Expand}
                              size="sm"
                              className="text-primary-700 dark:text-primary-800"
                            />
                          </HStack>
                        </Pressable>
                      ) : (
                        <Text className="text-sm text-secondary-950">
                          No proof attached
                        </Text>
                      )}
                      {onAction && entry.status === "requested" && payerIsYou && (
                        <VStack className="gap-y-3">
                          <FormTextarea label="Note (Optional)" placeholder="Add a note for the sender"
                            value={notes[entry.id] ?? ""}
                            onChangeText={(note) => setNotes((current) => ({ ...current, [entry.id]: note }))} />
                          <HStack className="gap-x-2">
                            <ConfirmButton className="flex-1" text="Reject" variant="outline"
                              disabled={!!busyPaymentId} confirmText="Reject Payment"
                              confirmTitle="Reject This Payment?"
                              confirmDescription="The payment will stay in history with its notes and proof. The remaining balance will stay the same."
                              onConfirm={() => onAction(entry, "reject", notes[entry.id] ?? "")} />
                            <FormButton className="flex-1" text="Confirm"
                              loading={busyPaymentId === entry.id} disabled={!!busyPaymentId}
                              onPress={() => { void onAction(entry, "confirm", notes[entry.id] ?? ""); }} />
                          </HStack>
                        </VStack>
                      )}
                      {onAction && entry.status === "requested" && memberIsYou && (
                        <ConfirmButton text="Withdraw Request" variant="outline" disabled={!!busyPaymentId}
                          confirmText="Withdraw Request" confirmTitle="Withdraw This Request?"
                          confirmDescription="The request will remain in payment history and will no longer await confirmation."
                          onConfirm={() => onAction(entry, "withdraw", "")} />
                      )}
                      {onAction && entry.status === "confirmed" && payerIsYou && (
                        <VStack className="gap-y-2">
                          <ConfirmButton text="Reopen Payment" variant="outline" disabled={!!busyPaymentId || hasPending}
                            confirmText="Reopen Payment" confirmTitle="Reopen This Payment?"
                            confirmDescription="This payment will await confirmation again. Its amount will be added back to the remaining balance."
                            onConfirm={() => onAction(entry, "reopen", "")} />
                          {hasPending && <Text className="text-xs text-secondary-950">Resolve the pending payment before reopening another.</Text>}
                        </VStack>
                      )}
                    </VStack>
                  )}
                </AccordionContent>
                {index < newestFirst.length - 1 && (
                  <Box className="mx-4">
                    <Divider className="border-secondary-200" />
                  </Box>
                )}
              </AccordionItem>
            ))}
          </Accordion>
        </Box>
      </VStack>
      <ImageViewerSheet
        isOpen={proofUri !== null}
        onClose={() => setProofUri(null)}
        uri={proofUri}
        title="Proof of Payment"
      />
    </>
  );
}

function HistoryDetail({ label, value }: { label: string; value: string }) {
  return (
    <HStack className="items-start gap-x-4">
      <Text className="flex-1 text-sm text-secondary-950">{label}</Text>
      <Text className="flex-1 text-sm text-right">{value}</Text>
    </HStack>
  );
}

function HistoryNote({ label, note }: { label: string; note: string }) {
  return (
    <VStack className="gap-y-1">
      <Text className="text-sm text-secondary-950">{label}</Text>
      <Text>{note}</Text>
    </VStack>
  );
}

function historyDate(value: string, compact = false) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : format(date, compact ? "MMM d · h:mm a" : "MMM d, yyyy · h:mm a");
}
