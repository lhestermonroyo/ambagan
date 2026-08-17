import AppBadge from "@/components/AppBadge";
import CategoryIcon from "@/components/CategoryIcon";
import Icon from "@/components/Icon";
import PressableListItem from "@/components/PressableListItem";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { expenseCategoryMeta } from "@/features/expense/components/CategorySheet";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import { PersonalExpense } from "@/types/books";
import { formatDate } from "@/utils/formatDate";
import { CircleCheck, Clock } from "lucide-react-native";

export default function PersonalExpenseItem({
  details,
  onOpen,
  onToggleStatus,
  togglingStatus = false
}: {
  details: PersonalExpense;
  onOpen: () => void;
  /** Flip paid⇄pending inline. Omit to render the pill as a static label. */
  onToggleStatus?: () => void;
  /** Dims the pill while its toggle is in flight. */
  togglingStatus?: boolean;
}) {
  const isPaid = details.status === "paid";

  // Same icon + color language as the settlement StatusBadge so paid/pending
  // reads as one family with settled/pending/requested.
  const pill = (
    <AppBadge
      size="sm"
      action={isPaid ? "success" : "warning"}
      text={isPaid ? "Paid" : "Pending"}
      icon={
        isPaid ? (
          <CircleCheck size={12} color="#2A7948" />
        ) : (
          <Clock size={12} color="#D76C1F" />
        )
      }
    />
  );

  return (
    <PressableListItem onPress={onOpen} className="p-4">
      <HStack className="items-start gap-x-3">
        <CategoryIcon icon={expenseCategoryMeta(details.category).icon} />
        <HStack className="flex-1 gap-x-2 items-center">
          <VStack className="flex-1 gap-y-1">
            <Text className="text-lg" numberOfLines={2} ellipsizeMode="tail">
              {details.description}
            </Text>
            <HStack className="gap-x-2 items-center">
              {details.pending && (
                <Icon as="sync" size={14} className="text-primary-400" />
              )}
              <Text className="text-sm text-secondary-950">
                {formatDate(details.expense_date)}
              </Text>
            </HStack>
          </VStack>
          <VStack className="items-end gap-y-1">
            <Text className="text-lg font-medium text-right">
              {formatAmount(details.amount, details.currency)}
            </Text>
            {/* Tappable so the status can be flipped without opening the form;
                falls back to a static label when no handler is given. */}
            {onToggleStatus ? (
              <Pressable
                disabled={togglingStatus}
                onPress={onToggleStatus}
                className={togglingStatus ? "opacity-50" : undefined}
                accessibilityRole="button"
                accessibilityLabel={`Mark ${isPaid ? "pending" : "paid"}`}
              >
                {pill}
              </Pressable>
            ) : (
              pill
            )}
          </VStack>
          <Icon as="chevron-right" className="text-secondary-950" />
        </HStack>
      </HStack>
    </PressableListItem>
  );
}
