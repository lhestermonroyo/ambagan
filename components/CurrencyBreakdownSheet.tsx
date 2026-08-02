import ApproxRateNote from "@/components/ApproxRateNote";
import ListDivider from "@/components/ListDivider";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import { getRate, useFxRates } from "@/utils/fx";
import { cn } from "@gluestack-ui/utils/nativewind-utils";

export type CurrencyAmount = {
  currency: string;
  amount: number;
  /**
   * Optional second figure for the same currency, shown beneath `amount` —
   * e.g. pending spend under paid spend. Needs `secondaryLabel` to render.
   * Survives `convertTo` mode, where it sits between the amount and its
   * conversion: it's a different slice of the same currency, not a restatement
   * of `amount`, so folding rates in is no reason to drop it. Only `amount`
   * feeds the converted total.
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
  /**
   * Turns the sheet into the explainer for a single converted figure: every row
   * gains its value in this currency beneath the original, and a TOTAL row
   * closes the list. That total is the whole point — a card showing one "≈"
   * number has nowhere to show its working, so the sheet has to add up to
   * exactly what the card said.
   *
   * Each row still LEADS with the amount as entered, because that's the only
   * exact figure on screen; the conversion is the derived one and reads as
   * secondary. Currencies with no rate say so and are left out of the total
   * rather than counted as zero.
   */
  convertTo?: string;
  /** Row label for the `convertTo` total. */
  totalLabel?: string;
}

export default function CurrencyBreakdownSheet({
  isOpen,
  onClose,
  title,
  subtitle,
  items,
  secondaryLabel,
  convertTo,
  totalLabel = "Total"
}: CurrencyBreakdownSheetProps) {
  const fx = useFxRates();

  // Priced once here so the rows, the total and the rate note can't disagree
  // about which currencies made it in.
  const priced = items.map((item) => ({
    ...item,
    converted: convertTo
      ? (() => {
          const rate = getRate(fx, item.currency, convertTo);
          return rate === null ? null : item.amount * rate;
        })()
      : null
  }));

  const total = priced.reduce((sum, i) => sum + (i.converted ?? 0), 0);
  const convertedCurrencies = priced
    .filter((i) => i.converted !== null && i.currency !== convertTo)
    .map((i) => i.currency);
  const notCounted = priced.filter((i) => i.converted === null);

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
            data={priced}
            scrollEnabled={false}
            keyExtractor={(item) => item.currency}
            renderItem={({
              item: { currency, amount, secondaryAmount, converted }
            }) => {
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
                    {/* The book's own currency needs no conversion line — it
                        would just repeat the amount above it. */}
                    {convertTo && currency !== convertTo && (
                      <Text className="text-sm text-secondary-950">
                        {converted === null
                          ? "Not counted"
                          : `≈ ${formatAmount(converted, convertTo)}`}
                      </Text>
                    )}
                  </VStack>
                </HStack>
              );
            }}
            ItemSeparatorComponent={ListDivider}
            ListFooterComponent={
              convertTo ? (
                <VStack>
                  <Divider className="h-0.5" />
                  <HStack className="items-center justify-between p-4">
                    <Text bold className="text-lg">
                      {totalLabel}
                    </Text>
                    <Text bold className="text-lg">
                      {convertedCurrencies.length > 0 ? "≈ " : ""}
                      {formatAmount(total, convertTo)}
                    </Text>
                  </HStack>
                  <VStack className="px-4 pb-4 gap-y-1">
                    {notCounted.length > 0 && (
                      <Text className="text-xs text-secondary-800">
                        {notCounted.map((i) => i.currency).join(", ")} left out —
                        no conversion rate available.
                      </Text>
                    )}
                    <ApproxRateNote currencies={convertedCurrencies} />
                  </VStack>
                </VStack>
              ) : null
            }
          />
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
