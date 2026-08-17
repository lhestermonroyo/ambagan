import CurrencyCountButton from "@/components/CurrencyCountButton";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { getRate, useConvertedTotal, useFxRates } from "@/utils/fx";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { useMemo } from "react";
import { amountTextSize } from "../utils/amountTextSize";
import { formatAmount } from "../utils/formatAmount";

export default function CurrencyAmountDisplay({
  items,
  label,
  subtitle = "Breakdown by currency",
  type = "neutral",
  isLoading = false,
  primaryCurrency = "PHP",
  amountClassName,
  fitAmount = false,
  convertTo,
  totalLabel
}: {
  items: { currency: string; amount: number }[];
  label: string;
  /** Sheet subtitle. Defaults to a generic per-currency caption. */
  subtitle?: string;
  type?: "pay" | "receive" | "neutral";
  isLoading?: boolean;
  primaryCurrency?: string;
  /** Extra classes for the amount text — e.g. a card-specific colour. */
  amountClassName?: string;
  /** Shrink the amount to one line instead of wrapping (for narrow cards). */
  fitAmount?: boolean;
  /**
   * Turns the headline into a single approximate TOTAL in this currency instead
   * of just the primary currency's slice, and gives the sheet the matching
   * per-currency working.
   *
   * Opt-in, and for SUMMARIES only — a To Collect or To Pay stat, not a
   * settlement row. The stat answers "how much am I owed", which no one pays
   * directly; the row underneath is the thing that gets paid and stays in the
   * currency it's payable in (see utils/fx).
   */
  convertTo?: string;
  /** Row label for the sheet's total in `convertTo` mode. */
  totalLabel?: string;
}) {
  const fx = useFxRates();

  // In convertTo mode the biggest contributor leads, measured in the target
  // currency so the ordering holds across currencies; otherwise the original
  // primary-first order stands.
  const sorted = useMemo(() => {
    if (!convertTo) {
      return [...items].sort((a, b) =>
        a.currency === primaryCurrency
          ? -1
          : b.currency === primaryCurrency
            ? 1
            : 0
      );
    }
    return [...items].sort((a, b) => {
      if (a.currency === convertTo) return -1;
      if (b.currency === convertTo) return 1;
      return (
        b.amount * (getRate(fx, b.currency, convertTo) ?? 0) -
        a.amount * (getRate(fx, a.currency, convertTo) ?? 0)
      );
    });
  }, [items, primaryCurrency, convertTo, fx]);

  // Inert unless convertTo is set, so the settlement screens that leave it off
  // keep showing exactly the figure they were handed.
  const { total, convertedCurrencies } = useConvertedTotal(items, convertTo);

  const [primary] = sorted;

  const amountColor = type === "pay" ? "text-error-400" : undefined;

  const amountText = convertTo
    ? `${convertedCurrencies.length > 0 ? "≈ " : ""}${formatAmount(total, convertTo)}`
    : formatAmount(primary?.amount ?? 0, primary?.currency ?? primaryCurrency);

  // fitAmount callers are the two-up stat cards, so the line is half a card
  // wide once the chip has taken its share.
  const amountSize = fitAmount
    ? amountTextSize("text-xl", amountText, 11)
    : "text-xl";

  if (isLoading) {
    return (
      <Text bold className={cn("text-3xl", amountColor, amountClassName)}>
        -
      </Text>
    );
  }

  return (
    <HStack className="items-center gap-x-2">
      <Text
        bold
        className={cn(amountSize, "flex-shrink", amountColor, amountClassName)}
        numberOfLines={fitAmount ? 1 : undefined}
      >
        {amountText}
      </Text>
      <CurrencyCountButton
        items={sorted}
        title={label}
        subtitle={subtitle}
        convertTo={convertTo}
        totalLabel={totalLabel}
      />
    </HStack>
  );
}
