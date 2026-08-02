import CurrencyBreakdownSheet, {
  type CurrencyAmount
} from "@/components/CurrencyBreakdownSheet";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { ChevronRight } from "lucide-react-native";
import { useState } from "react";

interface CurrencyCountButtonProps {
  /** Full sorted list — the first item is primary; the rest drive the count. */
  items: CurrencyAmount[];
  title: string;
  subtitle?: string;
  /** Caption for each item's `secondaryAmount` in the sheet (e.g. "pending"). */
  secondaryLabel?: string;
  /** Shows each row converted into this currency, plus a total. See
   *  {@link CurrencyBreakdownSheet}'s `convertTo`. */
  convertTo?: string;
  totalLabel?: string;
}

export default function CurrencyCountButton({
  items,
  title,
  subtitle,
  secondaryLabel,
  convertTo,
  totalLabel
}: CurrencyCountButtonProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  // A currency with nothing in it is noise behind this chip: it inflates the
  // count and opens a sheet with a zero row that changes no total. Only the
  // TAIL is filtered — items[0] is the figure the caller is already showing, so
  // it stays even at zero, and the chip's job is purely to say what else there
  // is. Filtering the head instead would hide a funded currency whenever the
  // headline one happened to be zero, which is exactly the case the chip
  // exists for. A row survives if EITHER figure has money in it, so a currency
  // that's all pending keeps its place.
  const secondary = items
    .slice(1)
    .filter((item) => item.amount !== 0 || (item.secondaryAmount ?? 0) !== 0);

  // Nothing else to show — on an all-zero stat this is what removes the chip.
  if (secondary.length === 0) return null;

  return (
    <>
      <Pressable onPress={() => setSheetOpen(true)}>
        <HStack className="rounded-xl px-2 py-0.5 items-center gap-x-0.5 bg-primary-500">
          <Text className="text-xs text-white font-semibold">
            +{secondary.length}
          </Text>
          <ChevronRight size={12} color="#fff" />
        </HStack>
      </Pressable>

      <CurrencyBreakdownSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={title}
        subtitle={subtitle}
        items={[items[0], ...secondary]}
        secondaryLabel={secondaryLabel}
        convertTo={convertTo}
        totalLabel={totalLabel}
      />
    </>
  );
}
