import CurrencyCountButton from "@/components/CurrencyCountButton";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { getRate, useConvertedTotal, useFxRates } from "@/utils/fx";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { useMemo } from "react";
import { amountTextSize } from "../utils/amountTextSize";
import { formatAmount } from "../utils/formatAmount";

/**
 * "How do I stand overall" — the net of every currency, folded into one figure
 * at an approximate rate (see utils/fx).
 *
 * This is a SUMMARY, so it may convert. A net balance is already an abstraction
 * — collect minus pay, across groups — and one that can't be acted on directly:
 * nobody settles a net. Each settlement row underneath stays in the currency
 * it's payable in, because a ¥10,000 debt is not settleable in pesos at our
 * rate. The exact per-currency working is one tap away behind the chip, which
 * is also where the rate note and attribution live — the card itself carries
 * only the "≈", so a stat stays readable at a glance.
 *
 * Home, group detail and friend detail each grew their own copy of this block
 * before there was anything to share; they differ only in tone and size, which
 * is what the props are for.
 */
export default function NetBalanceDisplay({
  items,
  currency,
  isLoading = false,
  tone = "default",
  size = "md",
  subtitle = "To Collect minus To Pay, per currency"
}: {
  items: { currency: string; amount: number }[];
  /** Target currency for the headline — the user's default. */
  currency: string;
  isLoading?: boolean;
  /** "onColor" for the home hero, which sits on the primary fill. */
  tone?: "default" | "onColor";
  size?: "md" | "lg";
  subtitle?: string;
}) {
  const fx = useFxRates();
  const { total, convertedCurrencies } = useConvertedTotal(items, currency);

  // Default currency leads, then whoever moves the needle most — measured on
  // the absolute value, since a large debt ranks with a large credit.
  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => {
        if (a.currency === currency) return -1;
        if (b.currency === currency) return 1;
        return (
          Math.abs(b.amount * (getRate(fx, b.currency, currency) ?? 0)) -
          Math.abs(a.amount * (getRate(fx, a.currency, currency) ?? 0))
        );
      }),
    [items, currency, fx]
  );

  const onColor = tone === "onColor";
  const amountSize = size === "lg" ? "text-4xl" : "text-3xl";
  const amountText = `${convertedCurrencies.length > 0 ? "≈ " : ""}${formatAmount(total, currency)}`;
  // The headline shares its row with the currency code and the chip, so the
  // budget is the rest of the line rather than the screen — "lg" is the
  // full-width hero, "md" the narrower group and friend cards.
  const fittedSize = amountTextSize(
    amountSize,
    amountText,
    size === "lg" ? 13 : 12
  );
  // On the colored hero everything is white — a red negative would fight the
  // fill, and the sign already reads from the minus.
  const amountColor = onColor
    ? "text-white"
    : total < 0
      ? "text-error-400"
      : undefined;

  return (
    <VStack className="gap-y-2">
      <Text
        bold
        className={cn(
          "text-sm uppercase",
          onColor ? "text-white" : "text-secondary-950"
        )}
      >
        Net Balance
      </Text>
      {isLoading ? (
        <Text bold className={cn(amountSize, onColor && "text-white")}>
          —
        </Text>
      ) : (
        <HStack className="items-end gap-x-2">
          <Text
            bold
            className={cn(fittedSize, amountColor, "flex-shrink")}
            numberOfLines={1}
          >
            {amountText}
          </Text>
          <HStack className="items-center gap-x-1 pb-1">
            <Text
              className={cn(
                "text-base",
                onColor ? "text-white/70" : "text-secondary-950"
              )}
            >
              {currency}
            </Text>
            <CurrencyCountButton
              items={sorted}
              title="Net Balance"
              subtitle={subtitle}
              convertTo={currency}
              totalLabel="Net balance"
            />
          </HStack>
        </HStack>
      )}
    </VStack>
  );
}
