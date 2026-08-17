import Icon from "@/components/Icon";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { ReactNode } from "react";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

/**
 * A labelled disclosure for the optional half of a form: the header row is
 * always there, `children` only when expanded.
 *
 * Deliberately the plain sibling of {@link
 * import("@/features/expense/components/ExpenseOptions").default} and styled to
 * match its expanded header, so the two read as one pattern. It has no collapsed
 * chip row because the two forms are used differently: an expense form is filled
 * several times a day, where one tap straight to the category sheet is worth a
 * whole row of chips, while a book is configured once and then left alone. Chips
 * also can't carry a field that isn't a sheet — a budget is a text input, and
 * putting one behind a chip would mean inventing a sheet purely to be chippable.
 *
 * Unlike ExpenseOptions the header shows in BOTH states, since without chips
 * beside it a lone chevron has nothing to explain it.
 *
 * Callers own `expanded`, so a form can open the section on mount when it's
 * editing something whose optional fields aren't on their defaults — otherwise
 * the collapsed state hides settings the user already chose.
 */
export default function MoreOptions({
  expanded,
  onToggle,
  label = "More options",
  children
}: {
  expanded: boolean;
  onToggle: () => void;
  label?: string;
  children: ReactNode;
}) {
  return (
    <VStack className="gap-y-6">
      {/* The whole header is the hit target, not just the chevron — the chevron
          is 36px in a form of 56px rows, and "More options" reads as tappable. */}
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        aria-label={expanded ? `Hide ${label}` : `Show ${label}`}
      >
        {({ pressed }) => (
          <HStack className={cn("items-center gap-x-4", pressed && "opacity-50")}>
            <HStack className="flex-1 items-center gap-x-4">
              <Text bold className="text-sm uppercase text-secondary-950">
                {label}
              </Text>
              <Divider className="border-secondary-100 flex-1" />
            </HStack>
            <HStack className="h-9 w-9 items-center justify-center rounded-full border border-background-200">
              <Icon
                as={expanded ? "expand-less" : "expand-more"}
                size={22}
                className="text-secondary-950"
              />
            </HStack>
          </HStack>
        )}
      </Pressable>

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
