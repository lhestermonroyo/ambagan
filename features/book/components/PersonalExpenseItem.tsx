import CategoryIcon from "@/components/CategoryIcon";
import Icon from "@/components/Icon";
import PressableListItem from "@/components/PressableListItem";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { expenseCategoryMeta } from "@/features/expense/components/CategorySheet";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import { PersonalExpense } from "@/types/books";
import { formatDate } from "@/utils/formatDate";

export default function PersonalExpenseItem({
  details,
  onOpen
}: {
  details: PersonalExpense;
  onOpen: () => void;
}) {
  return (
    <PressableListItem onPress={onOpen} className="p-4">
      <HStack className="items-start gap-x-3">
        <CategoryIcon icon={expenseCategoryMeta(details.category).icon} />
        <HStack className="flex-1 gap-x-2 items-center">
          <VStack className="flex-1">
            <Text className="text-lg" numberOfLines={2} ellipsizeMode="tail">
              {details.description}
            </Text>
            <HStack className="gap-x-1 items-center">
              {details.pending && (
                <Icon as="sync" size={14} className="text-primary-400" />
              )}
              <Text className="text-sm text-secondary-950">
                {formatDate(details.expense_date)} •{" "}
                {expenseCategoryMeta(details.category).label}
              </Text>
            </HStack>
          </VStack>
          <Text className="text-lg font-medium text-right">
            {formatAmount(details.amount, details.currency)}
          </Text>
          <Icon as="chevron-right" className="text-secondary-950" />
        </HStack>
      </HStack>
    </PressableListItem>
  );
}
