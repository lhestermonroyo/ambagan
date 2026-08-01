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
}

export default function CurrencyCountButton({
  items,
  title,
  subtitle,
  secondaryLabel
}: CurrencyCountButtonProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const secondary = items.slice(1);

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
        items={items}
        secondaryLabel={secondaryLabel}
      />
    </>
  );
}
