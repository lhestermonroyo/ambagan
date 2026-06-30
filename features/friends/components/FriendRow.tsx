import AppAvatar from "@/components/AppAvatar";
import Icon from "@/components/Icon";
import PressableListItem from "@/components/PressableListItem";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import { UserPreview } from "@/types/user";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { Heart } from "lucide-react-native";
import React, { useCallback } from "react";
import { useColorScheme } from "react-native";

type Balance = { amount: number; currency: string };

/**
 * Unified friend/contact row used across the Friends tab.
 *  - Shows the balance on the right ONLY when `balances` has an entry (a person
 *    you share money with); a pure contact renders without an amount.
 *  - Always shows the favorite heart toggle, reflecting `isFavorite`.
 */
const FriendRow = React.memo(function FriendRow({
  user,
  balances,
  isFavorite = false,
  onPress,
  onToggleFavorite
}: {
  user: UserPreview;
  balances?: Balance[];
  isFavorite?: boolean;
  onPress: (user: UserPreview) => void;
  onToggleFavorite: (user: UserPreview) => void;
}) {
  const colorScheme = useColorScheme() ?? "light";
  const [primary, ...rest] = balances ?? [];
  const isNegative = (primary?.amount ?? 0) < 0;

  const handlePress = useCallback(() => onPress(user), [user, onPress]);
  const handleToggle = useCallback(
    () => onToggleFavorite(user),
    [user, onToggleFavorite]
  );

  return (
    <PressableListItem className="p-4" onPress={handlePress}>
      <HStack className="gap-x-3 items-center">
        <AppAvatar name={user.first_name} uri={user.avatar || undefined} />
        <VStack className="flex-1">
          <Text className="text-lg">
            {user.first_name} {user.last_name}
          </Text>
          <Text className="text-sm text-secondary-950">{user.email}</Text>
        </VStack>
        <HStack className="gap-x-3 items-center">
          {primary && (
            <HStack className="gap-x-1 items-center">
              <Text className={cn("text-lg", isNegative && "text-error-400")}>
                {`${isNegative ? "-" : ""}${formatAmount(
                  Math.abs(primary.amount),
                  primary.currency
                )}`}
              </Text>
              {rest.length > 0 && (
                <Box className="bg-primary-400 rounded-full h-5 w-5 items-center justify-center">
                  <Text className="text-white text-xs font-semibold">
                    +{rest.length}
                  </Text>
                </Box>
              )}
            </HStack>
          )}
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
          <Icon as="chevron-right" className="text-secondary-950" />
        </HStack>
      </HStack>
    </PressableListItem>
  );
});

export default FriendRow;
