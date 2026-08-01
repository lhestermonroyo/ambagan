import CurrencyCountButton from "@/components/CurrencyCountButton";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { formatAmount } from "../utils/formatAmount";

export default function CurrencyAmountDisplay({
  items,
  label,
  subtitle = "Breakdown by currency",
  type = "neutral",
  isLoading = false,
  primaryCurrency = "PHP",
  amountClassName,
  fitAmount = false
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
}) {
  const sorted = [...items].sort((a, b) =>
    a.currency === primaryCurrency ? -1 : b.currency === primaryCurrency ? 1 : 0
  );
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
        {formatAmount(primary?.amount ?? 0, primary?.currency ?? primaryCurrency)}
      </Text>
      <CurrencyCountButton items={sorted} title={label} subtitle={subtitle} />
    </HStack>
  );
}
