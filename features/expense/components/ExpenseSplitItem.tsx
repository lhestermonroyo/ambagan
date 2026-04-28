import Icon from "@/components/Icon";
import PressableListItem from "@/components/PressableListItem";
import { Avatar } from "@/components/ui/avatar";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import StatusBadge from "@/features/expense/components/StatusBadge";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import states from "@/states";
import { PaymentPreview } from "@/types/expenses";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { BanknoteArrowDown, BanknoteArrowUp } from "lucide-react-native";

export default function ExpenseSplitItem({
  item,
  onOpen
}: {
  item: PaymentPreview;
  onOpen: () => void;
}) {
  const user = states.user();
  const { details: userDetails } = user;

  const isUserPayer = item.payer.id === userDetails?.id;
  const isUserMember = item.member.id === userDetails?.id;

  return (
    <PressableListItem className="p-4" onPress={onOpen}>
      <HStack className="gap-x-2">
        <Avatar
          size="sm"
          className={cn(isUserPayer ? "bg-success-400" : "bg-error-400")}
        >
          {isUserPayer ? (
            <BanknoteArrowDown size={16} color="#FFFFFF" />
          ) : (
            <BanknoteArrowUp size={16} color="#FFFFFF" />
          )}
        </Avatar>
        <VStack className="flex-1">
          <HStack className="gap-x-1 items-center">
            <Text className="text-lg">
              {item.member.first_name} {item.member.last_name}
              {isUserMember && " (You)"}
            </Text>
          </HStack>
          <Text className="text-sm text-secondary-950">pays</Text>
          <HStack className="gap-x-1 items-center">
            <Text className="text-lg">
              {item.payer.first_name} {item.payer.last_name}
              {isUserPayer && " (You)"}
            </Text>
          </HStack>
        </VStack>
        <HStack className="gap-x-2 items-center">
          <VStack className="items-end">
            <Text className="text-lg">{formatAmount(item.amount)}</Text>
            <StatusBadge status={item.status} size="lg" />
          </VStack>
          <Icon as="chevron-right" className="text-secondary-950" />
        </HStack>
      </HStack>
    </PressableListItem>
  );
}
