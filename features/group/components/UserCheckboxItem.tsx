import AppAvatar from "@/components/AppAvatar";
import Icon from "@/components/Icon";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { UserPreview } from "@/types/user";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import { getUserSubtitle } from "@/utils/userDisplay";
import { Heart } from "lucide-react-native";
import { useColorScheme } from "react-native";

export function UserCheckboxItem({
  item,
  disabled = false,
  isChecked = false,
  isFavorite = false,
  onToggleFavorite,
  onToggle
}: {
  item: UserPreview;
  disabled?: boolean;
  isChecked?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (user: UserPreview) => void;
  onToggle?: (item: UserPreview) => void;
}) {
  const colorScheme = useColorScheme() ?? "light";

  // Custom checkbox: the checked state is derived from the parent's selection
  // (a controlled prop), not from a checkbox group's internal state. Pressing
  // the row just reports the toggle intent, so it stays in sync even when the
  // selection changes elsewhere (e.g. removing a chip from the selected list).
  return (
    <Pressable
      key={item.id}
      disabled={disabled}
      onPress={() => onToggle?.(item)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isChecked, disabled }}
      className="px-4 justify-between"
      style={disabled ? { opacity: 0.4 } : undefined}
    >
      <VStack className="gap-y-4 py-4">
        <HStack className="items-center gap-x-4">
          <Box
            className={`w-6 h-6 rounded border-[3px] items-center justify-center ${
              isChecked
                ? "bg-primary-600 border-primary-600"
                : "border-outline-400 bg-transparent"
            }`}
          >
            {isChecked && (
              <Icon as="check" size={16} className="text-background-0" />
            )}
          </Box>
          <HStack className="gap-x-3 items-center flex-1">
            <AppAvatar
              name={item.first_name}
              uri={item.avatar!}
              size="md"
              isPlaceholder={item.is_placeholder}
            />
            <VStack>
              <Text className="text-lg">
                {item?.first_name} {item?.last_name}
              </Text>
              <Text className="text-sm text-secondary-950">
                {getUserSubtitle(item)}
              </Text>
            </VStack>
          </HStack>
          <Pressable onPress={() => onToggleFavorite?.(item)}>
            <Heart
              color={
                isFavorite
                  ? getPrimaryHex("text-primary-400")
                  : getSecondaryHex("text-secondary-950", colorScheme)
              }
              fill={isFavorite ? getPrimaryHex("text-primary-400") : "none"}
            />
          </Pressable>
        </HStack>
      </VStack>
    </Pressable>
  );
}
