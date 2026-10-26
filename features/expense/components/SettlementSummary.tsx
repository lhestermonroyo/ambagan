import AppAvatar from "@/components/AppAvatar";
import ApproximateAmount from "@/components/ApproximateAmount";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import useUserState from "@/features/user/states/user.state";
import { Payment, PaymentStatus } from "@/types/expenses";
import { getPrimaryHex } from "@/utils/getColorHex";
import { ArrowRight } from "lucide-react-native";
import { useColorScheme } from "react-native";
import { amountTextSize } from "../utils/amountTextSize";
import { formatAmount } from "../utils/formatAmount";
import SettlementBreakdown from "./SettlementBreakdown";

/** The member repays the original expense payer, so the arrow always follows
 *  member → payer regardless of which participant opened the sheet. */
type SummaryProps = {
  payment: Payment;
  confirmedPaidAmount?: number;
  /** Omitted in the isolated example, whose expense does not exist in the DB. */
  showBreakdown?: boolean;
};

export default function SettlementSummary(props: SummaryProps) {
  return props.payment ? <SettlementSummaryContent {...props} /> : null;
}

// Mount the hook-driven content only when a payment exists, so an empty
// summary never changes the number or order of hooks between renders.
function SettlementSummaryContent({
  payment,
  confirmedPaidAmount = payment.confirmed_paid_amount ?? 0,
  showBreakdown = true
}: SummaryProps) {
  const userDetails = useUserState((state) => state.details);
  const scheme = useColorScheme() === "dark" ? "dark" : "light";

  const senderIsYou = payment.member.id === userDetails?.id;
  const recipientIsYou = payment.payer.id === userDetails?.id;
  const sender = senderIsYou ? "You" : payment.member.first_name;
  const recipient = recipientIsYou ? "You" : payment.payer.first_name;
  const senderLabel = senderIsYou
    ? `${userDetails?.first_name || payment.member.first_name} (You)`
    : sender;
  const recipientLabel = recipientIsYou
    ? `${userDetails?.first_name || payment.payer.first_name} (You)`
    : recipient;
  const verb =
    payment.status === PaymentStatus.SETTLED
      ? "paid"
      : senderIsYou
        ? "pay"
        : "pays";
  const hasConfirmedPayments =
    Number.isFinite(confirmedPaidAmount) && confirmedPaidAmount > 0;
  const partiallyPaid =
    hasConfirmedPayments &&
    confirmedPaidAmount < payment.amount &&
    payment.status !== PaymentStatus.SETTLED;
  const displayAmount = partiallyPaid
    ? payment.amount - confirmedPaidAmount
    : payment.amount;
  const amountText = formatAmount(displayAmount || 0, payment.currency);
  const amountSize = amountTextSize("text-4xl", amountText, 13);

  return (
    <VStack className="rounded-2xl bg-secondary-100 overflow-hidden">
      <VStack className="p-6 gap-y-4 items-center">
        <HStack className="self-center items-start justify-center gap-x-2">
          <VStack className="w-20 items-center gap-y-2">
            <AppAvatar
              name={payment.member.first_name}
              uri={payment.member.avatar || undefined}
              size="lg"
              isPlaceholder={payment.member.is_placeholder}
            />
            <Text
              className="text-sm text-secondary-950 text-center"
              numberOfLines={2}
            >
              {senderLabel}
            </Text>
          </VStack>
          <Box className="mt-4 h-8 w-8 items-center justify-center">
            <ArrowRight
              size={24}
              color={getPrimaryHex("text-primary-500", scheme)}
            />
          </Box>
          <VStack className="w-20 items-center gap-y-2">
            <AppAvatar
              name={payment.payer.first_name}
              uri={payment.payer.avatar || undefined}
              size="lg"
              isPlaceholder={payment.payer.is_placeholder}
            />
            <Text
              className="text-sm text-secondary-950 text-center"
              numberOfLines={2}
            >
              {recipientLabel}
            </Text>
          </VStack>
        </HStack>

        <VStack className="w-full items-center gap-y-1">
          <Text
            bold
            accessibilityRole="header"
            className="text-sm text-secondary-950 uppercase tracking-wide text-center"
          >
            {sender} {verb} {recipient}
          </Text>
          {partiallyPaid && (
            <Text className="text-sm text-secondary-950">Remaining Balance</Text>
          )}
          <Text
            bold
            className={cn(amountSize, "text-center w-full")}
            numberOfLines={1}
          >
            {amountText}
          </Text>
          <ApproximateAmount
            amount={displayAmount || 0}
            currency={payment.currency}
            reportingCurrency={payment.reporting_currency}
          />
          {!!payment.expense_description && (
            <Text className="text-base text-center">
              {payment.expense_description}
            </Text>
          )}
        </VStack>
        {hasConfirmedPayments && (
          <VStack className="w-full gap-y-2">
            <Text className="text-sm text-secondary-950 text-center">
              {formatAmount(confirmedPaidAmount, payment.currency)} of{" "}
              {formatAmount(payment.amount, payment.currency)} paid
            </Text>
            <Box
              className="h-1 rounded-full bg-secondary-200 overflow-hidden"
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel="Confirmed payment progress"
              accessibilityValue={{ min: 0, max: payment.amount, now: confirmedPaidAmount }}
            >
              <Box
                className="h-full rounded-full bg-primary-500"
                style={{ width: `${payment.amount > 0 ? Math.min(100, (confirmedPaidAmount / payment.amount) * 100) : 0}%` }}
              />
            </Box>
          </VStack>
        )}
      </VStack>
      {showBreakdown && (
        <Box className="w-full">
          <Divider className="border-secondary-200" />
          <SettlementBreakdown payment={payment} />
        </Box>
      )}
    </VStack>
  );
}
