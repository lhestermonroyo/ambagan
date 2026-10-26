import CurrencyBreakdownSheet from "@/components/CurrencyBreakdownSheet";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import { BASE_CURRENCY, useConverter } from "@/utils/fx";
import { useState } from "react";

/** Secondary reference value; tap the caption for rate details without a count chip.
 *  The original amount remains the payable amount. */
export default function ApproximateAmount({
  amount,
  currency,
  reportingCurrency = BASE_CURRENCY
}: {
  amount: number;
  currency: string;
  reportingCurrency?: string;
}) {
  const convert = useConverter(reportingCurrency);
  const [sheetOpen, setSheetOpen] = useState(false);
  if (currency === reportingCurrency) return null;
  const converted = convert(amount, currency);

  return (
    <>
      <Pressable
        className="self-center"
        onPress={() => setSheetOpen(true)}
        accessibilityRole="button"
        accessibilityHint="View conversion rate details"
        hitSlop={8}
      >
        <Text className="text-xs text-secondary-950">
          {converted === null
            ? "Conversion rate unavailable"
            : `Approx. ${formatAmount(converted, reportingCurrency)} ${reportingCurrency}`}
        </Text>
      </Pressable>
      <CurrencyBreakdownSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        items={[{ currency, amount }]}
        title="Approximate Value"
        subtitle="Original amount and reporting currency conversion"
        convertTo={reportingCurrency}
        totalLabel="Approximate Total"
      />
    </>
  );
}
