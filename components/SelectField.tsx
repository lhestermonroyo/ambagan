import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { MaterialIcons } from "@expo/vector-icons";
import Icon from "./Icon";
import PressableListItem from "./PressableListItem";
import { Box } from "./ui/box";
import { HStack } from "./ui/hstack";

/**
 * A tappable form field that opens a selection sheet/picker. Renders a
 * fixed-height, bordered row: an optional `leading` element, the current value
 * (`children`, given the flexible middle slot), and a trailing chevron. Use for
 * category, date, payer, group, and similar "tap to choose" fields so they all
 * share one standard height and look.
 */
export default function SelectField({
  onPress,
  leading,
  children,
  trailingIcon = "unfold-more",
  disabled = false,
  className
}: {
  onPress: () => void;
  leading?: React.ReactNode;
  children: React.ReactNode;
  trailingIcon?: React.ComponentProps<typeof MaterialIcons>["name"];
  disabled?: boolean;
  className?: string;
}) {
  return (
    <PressableListItem
      onPress={onPress}
      disabled={disabled}
      className={cn(
        "h-16 items-center justify-center px-4 border border-background-200 rounded-lg",
        className
      )}
    >
      <HStack className="items-center gap-x-2">
        {leading}
        <Box className="flex-1">{children}</Box>
        <Icon as={trailingIcon} className="text-sm text-secondary-950" />
      </HStack>
    </PressableListItem>
  );
}
