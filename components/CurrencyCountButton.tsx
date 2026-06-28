import CurrencyBreakdownSheet from "@/components/CurrencyBreakdownSheet";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { getSecondaryHex } from "@/utils/getColorHex";
import { ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { useColorScheme } from "react-native";

type CurrencyAmount = { currency: string; amount: number };

interface CurrencyCountButtonProps {
  /** Full sorted list — the first item is primary; the rest drive the count. */
  items: CurrencyAmount[];
  title: string;
  subtitle?: string;
}

export default function CurrencyCountButton({
  items,
  title,
  subtitle
}: CurrencyCountButtonProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const secondary = items.slice(1);

  if (secondary.length === 0) return null;

  const colorScheme = useColorScheme() ?? "light";

  return (
    <>
      <Pressable onPress={() => setSheetOpen(true)}>
        <HStack className="rounded-xl px-2 py-0.5 items-center gap-x-0.5 bg-primary-500">
          <Text className="text-xs text-secondary-0 font-semibold">
            +{secondary.length}
          </Text>
          <ChevronRight
            size={12}
            color={getSecondaryHex("text-secondary-0", colorScheme)}
          />
        </HStack>
      </Pressable>

      <CurrencyBreakdownSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={title}
        subtitle={subtitle}
        items={items}
      />
    </>
  );
}
