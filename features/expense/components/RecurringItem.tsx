import CategoryIcon from "@/components/CategoryIcon";
import Icon from "@/components/Icon";
import { Badge, BadgeText } from "@/components/ui/badge";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { expenseCategoryMeta } from "@/features/expense/components/CategorySheet";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import {
  endSummary,
  recurrenceSummary
} from "@/features/expense/utils/recurrence.util";
import { RecurrenceEndType, RecurrenceFrequency } from "@/types/expenses";
import { getSecondaryHex } from "@/utils/getColorHex";
import { format } from "date-fns";
import { Repeat } from "lucide-react-native";
import { useColorScheme } from "react-native";

/**
 * The card fields shared by a group {@link import("@/types/expenses").RecurringExpense}
 * and a personal {@link import("@/types/books").PersonalRecurring}. Both types
 * satisfy this structurally, so either can be passed straight through — the
 * card never touches the group-only payers/splits snapshots.
 */
export type RecurringItemDetails = {
  description: string;
  category: string;
  amount: number;
  currency: string;
  frequency: string;
  repeat_interval: number;
  end_type: string;
  end_date: string | null;
  occurrence_limit: number | null;
  next_run_at: string;
  is_active: boolean;
};

/**
 * One recurring-expense series card: amount, category, active/paused state and
 * the schedule (repeat rule, end rule, next run). Shared by the group and book
 * recurring lists so both read identically; the parent owns the data and the
 * navigation.
 */
export default function RecurringItem({
  details,
  onPress
}: {
  details: RecurringItemDetails;
  onPress: () => void;
  /** Hide the trailing affordance when the row doesn't navigate anywhere. */
}) {
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";
  const scheduleText = `${recurrenceSummary({
    frequency: details.frequency as RecurrenceFrequency,
    repeat_interval: details.repeat_interval
  })} • ${endSummary({
    end_type: details.end_type as RecurrenceEndType,
    end_date: details.end_date,
    occurrence_limit: details.occurrence_limit
  })}`;

  return (
    <Pressable
      className="bg-background-50 rounded-lg p-4 gap-y-4 data-[hover=true]:bg-background-100 data-[active=true]:bg-background-100"
      onPress={onPress}
    >
      <VStack className="gap-y-2">
        <HStack className="items-start justify-between gap-x-2">
          <HStack className="flex-1 items-center gap-x-3">
            <CategoryIcon icon={expenseCategoryMeta(details.category).icon} />
            <VStack className="flex-1 gap-y-0.5">
              <Text className="text-lg" numberOfLines={1}>
                {details.description}
              </Text>
            </VStack>
            <HStack className="items-center">
              <Badge
                size="sm"
                variant="solid"
                className={`rounded-full px-3 py-1 ${
                  details.is_active ? "bg-success-50" : "bg-background-200"
                }`}
              >
                <BadgeText
                  className={`font-bold text-xs uppercase ${
                    details.is_active
                      ? "text-success-600"
                      : "text-typography-700"
                  }`}
                >
                  {details.is_active ? "Active" : "Paused"}
                </BadgeText>
              </Badge>
            </HStack>
          </HStack>
        </HStack>

        <Text className="text-primary-500 text-2xl" bold>
          {formatAmount(details.amount, details.currency)}
        </Text>
      </VStack>
      <VStack className="gap-y-1">
        <HStack className="items-center gap-x-2">
          <Repeat
            size={16}
            color={getSecondaryHex("text-secondary-950", colorScheme)}
          />
          <Text className="text-sm text-secondary-950 flex-1">
            {scheduleText}
          </Text>
        </HStack>

        {details.is_active && (
          <HStack className="items-center gap-x-2">
            <Icon as="schedule" size={16} className="text-secondary-950" />
            <Text className="text-sm text-secondary-950 flex-1">
              Next: {format(new Date(details.next_run_at), "MMM d, yyyy")}
            </Text>
          </HStack>
        )}
      </VStack>
    </Pressable>
  );
}
