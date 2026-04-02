import Icon from "@/components/Icon";
import PressableListItem from "@/components/PressableListItem";
import { Avatar } from "@/components/ui/avatar";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import StatusBadge from "@/features/expense/components/StatusBadge";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import states from "@/states";
import { ExpenseSplitPreview } from "@/types/expenses";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import {
  BanknoteArrowDown,
  BanknoteArrowUp,
  ReceiptText
} from "lucide-react-native";
import { memo } from "react";

export default memo(function ExpenseSplitItem({
  item,
  onOpen
}: {
  item: ExpenseSplitPreview;
  onOpen: () => void;
}) {
  const user = states.user();
  const { details: userDetails } = user;

  const member = item.member;
  const expense = item.expense;

  const isUserPayer = item.paid_by === userDetails?.id;
  const isUserSplit = member?.id === userDetails?.id;
  const isPayer = item.paid_by === member?.id;

  if (isPayer) {
    return (
      <PressableListItem className="p-4" onPress={onOpen}>
        <HStack className="gap-x-2">
          <Avatar size="sm" className="bg-warning-400">
            <ReceiptText size={16} color="#FFFFFF" />
          </Avatar>
          <VStack className="flex-1">
            <HStack className="gap-x-1 items-center">
              <Text className="text-lg">
                {expense.paid_by.first_name} {expense.paid_by.last_name}
                {isUserSplit && " (You)"}
              </Text>
            </HStack>
            <Text className="text-sm text-secondary-950">paid for</Text>
            <HStack className="gap-x-1 items-center">
              <Text className="text-lg">
                {expense?.description || "Expense"}
              </Text>
            </HStack>
          </VStack>
          <HStack className="gap-x-2 items-center">
            <VStack className="items-end">
              <Text className="text-lg">
                {formatAmount(expense?.amount || 0)}
              </Text>
            </VStack>
            <Icon as="chevron-right" className="text-secondary-950" />
          </HStack>
        </HStack>
      </PressableListItem>
    );
  }

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
              {isUserSplit && " (You)"}
            </Text>
          </HStack>
          <Text className="text-sm text-secondary-950">owes</Text>
          <HStack className="gap-x-1 items-center">
            <Text className="text-lg">
              {expense.paid_by.first_name} {expense.paid_by.last_name}
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
});
