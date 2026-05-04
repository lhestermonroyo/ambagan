import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import { cn } from "@gluestack-ui/utils/nativewind-utils";

export default function BalanceCard({
  balance,
  className
}: {
  balance: number;
  className?: string;
}) {
  const isPositive = balance > 0;
  const isNegative = balance < 0;

  return (
    <Card
      className={cn(
        "rounded-lg",
        isPositive
          ? "bg-success-100 border border-success-200"
          : isNegative
            ? "bg-error-100 border border-error-200"
            : "bg-secondary-100",
        className
      )}
    >
      <Text
        bold
        className={cn(
          "text-2xl",
          isPositive
            ? "text-success-600"
            : isNegative
              ? "text-error-600"
              : "text-secondary-950"
        )}
      >
        {balance === 0 ? "—" : formatAmount(Math.abs(balance))}
      </Text>
      <Text
        className={cn(
          isPositive
            ? "text-success-500"
            : isNegative
              ? "text-error-700"
              : "text-secondary-950"
        )}
      >
        {isPositive ? "To Receive" : isNegative ? "To Pay" : "All Settled Up"}
      </Text>
    </Card>
  );
}
