import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { AmountTextSize } from "@/features/expense/utils/amountTextSize";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { ReactNode } from "react";

/**
 * The headline band of a hero card: a small caps label over one big figure,
 * with the currency code and an optional chip riding the baseline.
 *
 * Extracted so the Overview's two hero pages are the same height BY
 * CONSTRUCTION rather than by measurement — they swap in the same slot, and two
 * hand-built headlines that drifted a few points apart would make the purple
 * block jump mid-swipe. Anything that changes the vertical rhythm here changes
 * it for both pages at once, which is the point.
 *
 * `amountSize` is the caller's business: fitting a figure to its box needs the
 * box's width (see amountTextSize), and pages that share a slot need to agree
 * on one size rather than each fit its own.
 */
export default function HeroAmount({
  label,
  amountText,
  amountSize,
  currency,
  chip,
  isLoading = false,
  tone = "default",
  amountClassName,
  labelAccessory
}: {
  label: string;
  amountText: string;
  amountSize: AmountTextSize;
  /** Shown beside the figure — the code the headline is expressed in. */
  currency: string;
  /** Usually a CurrencyCountButton; omitted when there's nothing to break down. */
  chip?: ReactNode;
  isLoading?: boolean;
  /** "onColor" for a card sitting on the primary fill. */
  tone?: "default" | "onColor";
  /** Colour for the figure itself, when the caller judges it (e.g. negatives). */
  amountClassName?: string;
  /**
   * Trailing glyph for the label row — a chevron on a page that taps through.
   * Keep it at or under the label's 20pt line box so it can't add height.
   */
  labelAccessory?: ReactNode;
}) {
  const onColor = tone === "onColor";

  return (
    <VStack className="gap-y-2">
      <HStack className="items-center gap-x-2">
        <Text
          bold
          className={cn(
            "text-sm uppercase flex-1",
            onColor ? "text-white" : "text-secondary-950"
          )}
          numberOfLines={1}
        >
          {label}
        </Text>
        {labelAccessory}
      </HStack>
      {isLoading ? (
        <Text bold className={cn(amountSize, onColor && "text-white")}>
          —
        </Text>
      ) : (
        <HStack className="items-end gap-x-2">
          <Text
            bold
            className={cn(amountSize, amountClassName, "flex-shrink")}
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
            {chip}
          </HStack>
        </HStack>
      )}
    </VStack>
  );
}
