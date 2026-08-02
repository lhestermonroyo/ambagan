import CurrencyCountButton from "@/components/CurrencyCountButton";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { getRate, useFxRates } from "@/utils/fx";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { useMemo } from "react";
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
   * per-currency working. Opt-in, and only ever for spend: balances and
   * settlements have to stay exact and must not pass this (see utils/fx).
   *
   * The caller owns the disclosure — a converted figure needs the rate vintage
   * near it, which only the surrounding card knows where to put.
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

  // Total in the target currency, plus which foreign currencies actually made
  // it in — that's what decides whether the headline says "≈" at all. Anything
  // with no rate is left out rather than counted as zero; the sheet behind the
  // chip is where that omission is spelled out.
  const converted = useMemo(() => {
    if (!convertTo) return null;
    let total = 0;
    const currencies: string[] = [];
    for (const item of items) {
      const rate = getRate(fx, item.currency, convertTo);
      if (rate === null) continue;
      total += item.amount * rate;
      if (item.currency !== convertTo && item.amount !== 0) {
        currencies.push(item.currency);
      }
    }
    return { total, isApprox: currencies.length > 0 };
  }, [items, convertTo, fx]);

  const [primary] = sorted;

  const amountColor = type === "pay" ? "text-error-400" : undefined;

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
        className={cn("text-xl flex-shrink", amountColor, amountClassName)}
        numberOfLines={fitAmount ? 1 : undefined}
        adjustsFontSizeToFit={fitAmount}
      >
        {converted
          ? `${converted.isApprox ? "≈ " : ""}${formatAmount(converted.total, convertTo!)}`
          : formatAmount(
              primary?.amount ?? 0,
              primary?.currency ?? primaryCurrency
            )}
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
