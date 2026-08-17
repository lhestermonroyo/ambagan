import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { ReactNode } from "react";

/**
 * One half-width stat under a hero's headline: a badged icon and label over a
 * single figure.
 *
 * The badge is rendered here rather than passed in so every hero column is the
 * same height — the badge, not the label, is what sets the row's height (14pt
 * glyph in `p-1.5`, matching SettlementAvatar's light variant), and a caller
 * that passed a bare icon would quietly shrink its own column. See HeroAmount
 * for why the Overview needs that guarantee.
 *
 * Always on a colored fill today, so the palette is fixed.
 */
export default function HeroColumn({
  icon,
  label,
  valueText,
  valueClassName,
  chip,
  isLoading = false,
  accessibilityLabel
}: {
  /** A 14pt glyph — this wraps it in the badge itself. */
  icon: ReactNode;
  label: string;
  valueText: string;
  valueClassName?: string;
  chip?: ReactNode;
  isLoading?: boolean;
  /**
   * Spoken in place of "label, value" — for columns whose figure is a shorthand
   * ("12%") of something the sighted layout can only imply ("12% more than last
   * month to date").
   */
  accessibilityLabel?: string;
}) {
  return (
    <VStack
      className="flex-1 gap-y-2"
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
    >
      <HStack className="items-center gap-x-2">
        <Box className="bg-white/20 p-1.5 rounded-full">{icon}</Box>
        <Text className="text-white text-sm uppercase flex-1" numberOfLines={1}>
          {label}
        </Text>
      </HStack>
      {isLoading ? (
        <Text bold className="text-xl text-white">
          —
        </Text>
      ) : (
        <HStack className="items-center gap-x-2">
          <Text
            bold
            className={cn("text-white flex-shrink text-xl", valueClassName)}
            numberOfLines={1}
          >
            {valueText}
          </Text>
          {chip}
        </HStack>
      )}
    </VStack>
  );
}
