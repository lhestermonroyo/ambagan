import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { getPrimaryHex } from "@/utils/getColorHex";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { ReactNode } from "react";
import { ScrollView, useColorScheme } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

export type ExpenseOptionChip = {
  key: string;
  label: string;
  /** Rendered with the chip's resolved foreground color so the icon always
   *  matches the default/changed state. */
  icon?: (color: string) => ReactNode;
  /** Still on its default value. Default chips render muted; changed ones fill
   *  in, so one glance over the collapsed row shows what was actually touched. */
  isDefault?: boolean;
  onPress: () => void;
};

function OptionChip({ chip }: { chip: ExpenseOptionChip }) {
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";
  const changed = !chip.isDefault;
  const color = getPrimaryHex(
    changed ? "text-primary-600" : "text-primary-500",
    colorScheme
  );

  if (!changed) {
    return (
      <FormButton
        text={chip.label}
        onPress={chip.onPress}
        icon={chip.icon?.(color)}
        variant="outline"
        size="sm"
      />
    );
  }

  return (
    <Pressable onPress={chip.onPress} accessibilityRole="button">
      {({ pressed }) => (
        <HStack
          className={cn(
            "h-9 px-3 items-center gap-x-1.5 rounded-full border",
            changed
              ? "border-primary-200 bg-primary-50"
              : "border-background-200 bg-background-0",
            pressed && "opacity-50"
          )}
        >
          {chip.icon?.(color)}
          <Text
            bold={changed}
            numberOfLines={1}
            className={cn(
              "text-sm max-w-[160px]",
              changed ? "text-primary-600" : "text-secondary-950"
            )}
          >
            {chip.label}
          </Text>
        </HStack>
      )}
    </Pressable>
  );
}

/**
 * The optional half of an Add Expense form. Collapsed (the default) it is a
 * single row of chips — one per deferred field, each opening that field's own
 * sheet directly, so changing just the category stays a one-tap job. Expanded it
 * swaps the chips for `children`: the full-height `SelectField` rows and the
 * receipt uploader, laid out the way the form always was.
 *
 * The two states never show at once, so a field is never duplicated on screen.
 * Anything that must always be visible — amount, description, and the
 * destination group/book — belongs outside this component.
 */
export default function ExpenseOptions({
  chips,
  expanded,
  onToggle,
  children
}: {
  chips: ExpenseOptionChip[];
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <VStack className="gap-y-4">
      <HStack className="items-center gap-x-4">
        {expanded ? (
          <HStack className="flex-1 items-center gap-x-4">
            <Text bold className="text-sm uppercase text-secondary-950">
              More options
            </Text>
            <Divider className="border-secondary-100 flex-1" />
          </HStack>
        ) : (
          <ScrollView
            horizontal
            className="flex-1"
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 8, paddingRight: 4 }}
          >
            {chips.map((chip) => (
              <OptionChip key={chip.key} chip={chip} />
            ))}
          </ScrollView>
        )}

        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          aria-label={expanded ? "Hide more options" : "Show more options"}
        >
          {({ pressed }) => (
            <HStack
              className={cn(
                "h-9 w-9 items-center justify-center rounded-full border border-background-200",
                pressed && "opacity-50"
              )}
            >
              <Icon
                as={expanded ? "expand-less" : "expand-more"}
                size={22}
                className="text-secondary-950"
              />
            </HStack>
          )}
        </Pressable>
      </HStack>

      {expanded && (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(100)}
        >
          <VStack className="gap-y-6">{children}</VStack>
        </Animated.View>
      )}
    </VStack>
  );
}
