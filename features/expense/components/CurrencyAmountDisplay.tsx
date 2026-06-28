import CurrencyCountButton from "@/components/CurrencyCountButton";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { formatAmount } from "../utils/formatAmount";

export default function CurrencyAmountDisplay({
  items,
  label,
  type = "neutral",
  isLoading = false,
  primaryCurrency = "PHP"
}: {
  items: { currency: string; amount: number }[];
  label: string;
  type?: "pay" | "receive" | "neutral";
  isLoading?: boolean;
  primaryCurrency?: string;
}) {
  const sorted = [...items].sort((a, b) =>
    a.currency === primaryCurrency ? -1 : b.currency === primaryCurrency ? 1 : 0
  );
  const [primary] = sorted;

  const amountColor = type === "pay" ? "text-error-400" : undefined;

  if (isLoading) {
    return (
      <Text bold className={cn("text-3xl", amountColor)}>
        -
      </Text>
    );
  }

  return (
    <HStack className="items-center gap-x-2">
      <Text bold className={cn("text-2xl", amountColor)}>
        {formatAmount(primary?.amount ?? 0, primary?.currency ?? primaryCurrency)}
      </Text>
      <CurrencyCountButton
        items={sorted}
        title={label}
        subtitle="Breakdown by currency"
      />
    </HStack>
  );
}
