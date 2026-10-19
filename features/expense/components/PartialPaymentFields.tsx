import AppAvatar from "@/components/AppAvatar";
import FormInput from "@/components/FormInput";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { Payment } from "@/types/expenses";
import { getCurrencySign } from "@/utils/currency";
import { amountTextSize } from "../utils/amountTextSize";
import { formatAmount } from "../utils/formatAmount";
import { getRemainingPaymentAmount, isValidPartialPaymentAmount } from "../utils/settlementPayments.util";

export default function PartialPaymentFields({
  payment,
  amount,
  onChangeAmount,
  received = false,
  confirmedPaidAmount = 0
}: {
  payment: Payment;
  amount: string;
  onChangeAmount: (amount: string) => void;
  received?: boolean;
  confirmedPaidAmount?: number;
}) {
  const person = received ? payment.member : payment.payer;
  const remainingAmount = getRemainingPaymentAmount({ amount: payment.amount, confirmed_paid_amount: confirmedPaidAmount });
  const amountDue = formatAmount(remainingAmount, payment.currency);
  const enteredAmount = Number(amount);
  const validAmount = isValidPartialPaymentAmount(amount, remainingAmount);
  const error =
    amount.trim() === "" || validAmount
      ? undefined
      : enteredAmount >= remainingAmount
        ? "Enter a smaller amount, or choose Pay in Full."
        : "Enter an amount above zero, with up to 2 decimal places.";

  return (
    <VStack className="gap-y-6">
      <VStack className="bg-secondary-100 rounded-2xl p-4 gap-y-4">
        <HStack className="items-center gap-x-3">
          <AppAvatar
            name={person.first_name}
            uri={person.avatar || undefined}
            size="sm"
          />
          <VStack className="flex-1">
            <Text className="text-sm text-secondary-950">
              {received ? "Payment From" : "Payment to"}
            </Text>
            <Text className="font-medium">
              {person.first_name} {person.last_name}
            </Text>
          </VStack>
        </HStack>
        <VStack className="gap-y-1">
          <Text className="text-sm text-secondary-950">Amount Due</Text>
          <Text
            bold
            className={amountTextSize("text-2xl", amountDue, 18)}
            numberOfLines={1}
          >
            {amountDue}
          </Text>
          {!!payment.expense_description && (
            <Text className="text-sm text-secondary-950">
              {payment.expense_description}
            </Text>
          )}
        </VStack>
      </VStack>

      <VStack className="gap-y-2">
        <FormInput
          label={received ? "Amount Received" : "Amount Paid"}
          isRequired
          leftAddon={getCurrencySign(payment.currency) || payment.currency}
          placeholder="0.00"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={onChangeAmount}
          maxLength={15}
          errorMessage={error}
        />
        {validAmount ? (
          <HStack className="items-center justify-between gap-x-3">
            <Text className="text-sm text-secondary-950 flex-1">
              {received
                ? "Remaining After Recording"
                : "Remaining After Confirmation"}
            </Text>
            <Text className="text-sm font-medium">
              {formatAmount(remainingAmount - enteredAmount, payment.currency)}
            </Text>
          </HStack>
        ) : !error ? (
          <Text className="text-sm text-secondary-950">
            {received
              ? "Enter the part you received. The rest stays unpaid."
              : "Enter the part you paid. The rest stays unpaid."}
          </Text>
        ) : null}
      </VStack>
    </VStack>
  );
}
