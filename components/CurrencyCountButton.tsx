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
  const hasMoney = (item: CurrencyAmount) =>
    item.amount !== 0 || (item.secondaryAmount ?? 0) !== 0;

  const secondary = items.slice(1).filter(hasMoney);

  // In convertTo mode the count answers a different question — not "what else
  // is there" but "what got folded into this number" — so the head counts too
  // when it is itself foreign. That case is otherwise a chipless "≈ ₱383,700"
  // on a wallet holding nothing but yen, with no route to the rate vintage and
  // attribution that live in the sheet.
  const folded =
    convertTo &&
    items[0] &&
    items[0].currency !== convertTo &&
    hasMoney(items[0])
      ? 1
      : 0;
  const count = secondary.length + folded;

  // Nothing else to show — on an all-zero stat this is what removes the chip.
  if (count === 0) return null;

  return (
    <>
      <Pressable onPress={() => setSheetOpen(true)}>
        <HStack className="rounded-xl px-2 py-0.5 items-center gap-x-0.5 bg-primary-500">
          <Text className="text-xs text-white font-semibold">+{count}</Text>
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
