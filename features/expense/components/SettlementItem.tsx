import Icon from "@/components/Icon";
import PressableListItem from "@/components/PressableListItem";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import SettlementAvatar from "@/features/expense/components/SettlementAvatar";
import StatusBadge from "@/features/expense/components/StatusBadge";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import states from "@/states";
import { Payment, PaymentPreview } from "@/types/expenses";
import { formatDate } from "@/utils/formatDate";
import { cn } from "@gluestack-ui/utils/nativewind-utils";

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
        <SettlementAvatar isPayer={isUserPayer} />
        <VStack className="gap-y-2 flex-1">
          {item.expense_description && (
            <HStack className="gap-x-4 items-center flex-1">
              <Text
                className="text-sm text-secondary-950 uppercase flex-1"
                bold
                numberOfLines={1}
              >
                {item.expense_description}
              </Text>
              <Text className="text-sm text-secondary-950">
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
                <Text
                  className={cn(
                    "text-lg",
                    isUserMember ? "text-error-400" : undefined
                  )}
                >
                  {isUserMember && "-"}
                  {formatAmount(item.amount, item.currency)}
                </Text>
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
