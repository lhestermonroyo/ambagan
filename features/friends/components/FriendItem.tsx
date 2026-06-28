import AppAvatar from "@/components/AppAvatar";
import Icon from "@/components/Icon";
import PressableListItem from "@/components/PressableListItem";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import { FriendSummary } from "@/types/expenses";
import { UserPreview } from "@/types/user";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import { Heart } from "lucide-react-native";
import React, { useCallback } from "react";
import { useColorScheme } from "react-native";

const FriendItem = React.memo(function FriendItem({
  item,
  isFavorite = false,
  onPress,
  onToggleFavorite
}: {
  item: FriendSummary;
  isFavorite?: boolean;
  onPress: (item: FriendSummary) => void;
  onToggleFavorite?: (user: UserPreview) => void;
}) {
  const { friend, balances } = item;
  const [primary, ...rest] = balances;
  const isNegative = (primary?.amount ?? 0) < 0;
  const colorScheme = useColorScheme() ?? "light";

  const handlePress = useCallback(() => onPress(item), [item, onPress]);
  const handleToggle = useCallback(
    () => onToggleFavorite?.(friend),
    [friend, onToggleFavorite]
  );

  return (
    <PressableListItem className="p-4" onPress={handlePress}>
      <HStack className="gap-x-3 items-center">
        <AppAvatar name={friend.first_name} uri={friend.avatar || undefined} />
        <VStack className="flex-1">
          <Text className="text-lg">
            {friend.first_name} {friend.last_name}
          </Text>
          <Text className="text-sm text-secondary-950">{friend.email}</Text>
        </VStack>
        <HStack className="gap-x-3 items-center">
          <HStack className="gap-x-1 items-center">
            <Text className={cn("text-lg", isNegative && "text-error-400")}>
              {primary
                ? `${isNegative ? "-" : ""}${formatAmount(Math.abs(primary.amount), primary.currency)}`
                : "-"}
            </Text>
            {rest.length > 0 && (
              <Box className="bg-primary-400 rounded-full h-5 w-5 items-center justify-center">
                <Text className="text-white text-xs font-semibold">
                  +{rest.length}
                </Text>
              </Box>
            )}
          </HStack>
          {onToggleFavorite && (
            <Pressable onPress={handleToggle}>
              <Heart
                size={18}
                color={
                  isFavorite
                    ? getPrimaryHex("text-primary-400", colorScheme)
                    : getSecondaryHex("text-secondary-950", colorScheme)
                }
                fill={
                  isFavorite
                    ? getPrimaryHex("text-primary-400", colorScheme)
                    : "none"
                }
              />
            </Pressable>
          )}
          <Icon as="chevron-right" className="text-secondary-950" />
        </HStack>
      </HStack>
    </PressableListItem>
  );
});

export default FriendItem;
