import AppAvatar from "@/components/AppAvatar";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import states from "@/states";
import { Payment, PaymentStatus } from "@/types/expenses";
import { getPrimaryHex } from "@/utils/getColorHex";
import { ArrowRight } from "lucide-react-native";
import { useColorScheme } from "react-native";
import { formatAmount } from "../utils/formatAmount";
import SettlementBreakdown from "./SettlementBreakdown";

/** The member repays the original expense payer, so the arrow always follows
 *  member → payer regardless of which participant opened the sheet. */
export default function SettlementSummary({ payment }: { payment: Payment }) {
  const { details: userDetails } = states.user();
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
  const verb = payment.status === PaymentStatus.SETTLED ? "paid" : senderIsYou ? "pay" : "pays";

  return (
    <VStack className="rounded-2xl border border-secondary-200 bg-secondary-100 overflow-hidden">
      <VStack className="p-6 gap-y-4 items-center">
        <HStack className="self-center items-start justify-center gap-x-2">
          <VStack className="w-20 items-center gap-y-2">
            <AppAvatar
              name={payment.member.first_name}
              uri={payment.member.avatar || undefined}
              size="lg"
              isPlaceholder={payment.member.is_placeholder}
            />
            <Text className="text-sm text-secondary-950 text-center" numberOfLines={2}>
              {senderLabel}
            </Text>
          </VStack>
          <Box className="mt-4 h-8 w-8 items-center justify-center">
            <ArrowRight size={24} color={getPrimaryHex("text-primary-500", scheme)} />
          </Box>
          <VStack className="w-20 items-center gap-y-2">
            <AppAvatar
              name={payment.payer.first_name}
              uri={payment.payer.avatar || undefined}
              size="lg"
              isPlaceholder={payment.payer.is_placeholder}
            />
            <Text className="text-sm text-secondary-950 text-center" numberOfLines={2}>
              {recipientLabel}
            </Text>
          </VStack>
        </HStack>

        <VStack className="w-full items-center gap-y-1">
          <Text bold accessibilityRole="header" className="text-sm text-secondary-950 uppercase tracking-wide text-center">
            {sender} {verb} {recipient}
          </Text>
          <Text
            bold
            className="text-4xl text-center w-full"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {formatAmount(payment.amount || 0, payment.currency)}
          </Text>
          {!!payment.expense_description && (
            <Text className="text-base text-center">
              {payment.expense_description}
            </Text>
          )}
        </VStack>
      </VStack>
      <Box className="w-full">
        <Divider className="border-secondary-200" />
        <SettlementBreakdown payment={payment} />
      </Box>
    </VStack>
  );
}
