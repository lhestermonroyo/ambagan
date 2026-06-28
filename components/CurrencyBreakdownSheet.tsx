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

type CurrencyAmount = { currency: string; amount: number };

interface CurrencyBreakdownSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  items: CurrencyAmount[];
}

export default function CurrencyBreakdownSheet({
  isOpen,
  onClose,
  title,
  subtitle,
  items
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
            renderItem={({ item: { currency, amount } }) => {
              const amountClass = amount < 0 && "text-error-400";

              return (
                <HStack className="items-center justify-between p-4">
                  <Text className="text-lg">{currency}</Text>
                  <Text bold className={cn("text-lg", amountClass)}>
                    {formatAmount(amount, currency)}
                  </Text>
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
