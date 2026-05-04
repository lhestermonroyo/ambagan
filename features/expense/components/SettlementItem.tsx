import Icon from "@/components/Icon";
import PressableListItem from "@/components/PressableListItem";
import { Avatar } from "@/components/ui/avatar";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import StatusBadge from "@/features/expense/components/StatusBadge";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import states from "@/states";
import { Payment, PaymentPreview } from "@/types/expenses";
import { formatDate } from "@/utils/formatDate";
import { getErrorHex, getSuccessHex } from "@/utils/getColorHex";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { BanknoteArrowDown, BanknoteArrowUp } from "lucide-react-native";

export default function SettlementItem({
  item,
  onPress
}: {
  item: PaymentPreview | Payment;
  onPress: (payment: PaymentPreview | Payment) => void;
}) {
  const { details: userDetails } = states.user();

  const isUserPayer = item.payer.id === userDetails?.id;
  const isUserMember = item.member.id === userDetails?.id;

  return (
    <PressableListItem className="p-4" onPress={() => onPress(item)}>
      <HStack className="gap-x-2 items-start">
        <Avatar
          size="sm"
          className={cn(
            isUserPayer
              ? "bg-success-100 border border-success-200"
              : "bg-error-100 border border-error-200"
          )}
        >
          {isUserPayer ? (
            <BanknoteArrowDown
              size={16}
              color={getSuccessHex("text-success-600")}
            />
          ) : (
            <BanknoteArrowUp size={16} color={getErrorHex("text-error-600")} />
          )}
        </Avatar>
        <VStack className="gap-y-2 flex-1">
          {item.expense_description && (
            <HStack className="gap-x-4 items-center flex-1">
              <Text className="text-secondary-950 flex-1" numberOfLines={1}>
                {item.expense_description}
              </Text>
              <Text className="text-secondary-950">
                {formatDate(item.created_at)}
              </Text>
            </HStack>
          )}
          <HStack className="gap-x-4">
            <VStack className="flex-1">
              <Text className="text-lg">
                {item.member.first_name} {item.member.last_name}
                {isUserMember && " (You)"}
              </Text>
              <Text className="text-sm text-secondary-950">pays</Text>
              <Text className="text-lg">
                {item.payer.first_name} {item.payer.last_name}
                {isUserPayer && " (You)"}
              </Text>
            </VStack>
            <HStack className="gap-x-2 items-center">
              <VStack className="items-end">
                <Text className="text-lg">{formatAmount(item.amount)}</Text>
                <StatusBadge status={item.status} size="md" />
              </VStack>
              <Icon as="chevron-right" className="text-secondary-950" />
            </HStack>
          </HStack>
        </VStack>
      </HStack>
    </PressableListItem>
  );
}
