import ListDivider from "@/components/ListDivider";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import { cn } from "@gluestack-ui/utils/nativewind-utils";

export type CurrencyAmount = {
  currency: string;
  amount: number;
  /**
   * Optional second figure for the same currency, shown beneath `amount` —
   * e.g. pending spend under paid spend. Needs `secondaryLabel` to render.
   */
  secondaryAmount?: number;
};

interface CurrencyBreakdownSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  items: CurrencyAmount[];
  /** Caption for `secondaryAmount` (e.g. "pending"). Omit to hide it. */
  secondaryLabel?: string;
}

export default function CurrencyBreakdownSheet({
  isOpen,
  onClose,
  title,
  subtitle,
  items,
  secondaryLabel
}: CurrencyBreakdownSheetProps) {
  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full">
          <VStack className="p-4">
            <Text bold className="text-xl">
              {title}
            </Text>
            {subtitle && (
              <Text className="text-sm text-secondary-950">{subtitle}</Text>
            )}
          </VStack>
          <FlatList
            data={items}
            scrollEnabled={false}
            keyExtractor={(item) => item.currency}
            renderItem={({ item: { currency, amount, secondaryAmount } }) => {
              const amountClass = amount < 0 && "text-error-400";
              const showSecondary =
                !!secondaryLabel && secondaryAmount !== undefined;

              return (
                <HStack className="items-center justify-between p-4">
                  <Text className="text-lg">{currency}</Text>
                  <VStack className="items-end">
                    <Text bold className={cn("text-lg", amountClass)}>
                      {formatAmount(amount, currency)}
                    </Text>
                    {showSecondary && (
                      <Text className="text-sm text-secondary-950">
                        {formatAmount(secondaryAmount, currency)}{" "}
                        {secondaryLabel}
                      </Text>
                    )}
                  </VStack>
                </HStack>
              );
            }}
            ItemSeparatorComponent={ListDivider}
          />
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
