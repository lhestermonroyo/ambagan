import AppAvatar from "@/components/AppAvatar";
import Icon from "@/components/Icon";
import PressableListItem from "@/components/PressableListItem";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import { UserPreview } from "@/types/user";
import { BASE_CURRENCY, useConvertedTotal } from "@/utils/fx";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import { getUserSubtitle } from "@/utils/userDisplay";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { Heart } from "lucide-react-native";
import React, { useCallback } from "react";
import { useColorScheme } from "react-native";

type Balance = { amount: number; currency: string };

/** Stable identity for the no-balance case — useConvertedTotal memoizes on it. */
const NO_BALANCES: Balance[] = [];

/**
 * Unified friend/contact row used across the Friends tab.
 *  - Shows the balance on the right ONLY when `balances` has an entry (a person
 *    you share money with); a pure contact renders without an amount.
 *  - A row is a SUMMARY of where you stand with someone, so mixed currencies
 *    fold into one figure in the user's default currency, marked "≈" (see
 *    utils/fx). The per-currency working lives on the friend detail screen,
 *    one tap away — a list row is too small to carry a breakdown chip, and the
 *    old "+N" said there was more without saying it was more MONEY.
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
  if (!user || !balances) return null;

  const colorScheme = useColorScheme() ?? "light";
  const { total, convertedCurrencies } = useConvertedTotal(
    balances ?? NO_BALANCES,
    BASE_CURRENCY
  );
  const hasBalance = (balances?.length ?? 0) > 0;
  const isNegative = total < 0;
  const amountText = `${convertedCurrencies.length > 0 ? "≈ " : ""}${
    isNegative ? "-" : ""
  }${formatAmount(Math.abs(total), BASE_CURRENCY)}`;

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
          <Text className="text-sm text-secondary-950">
            {getUserSubtitle(user)}
          </Text>
        </VStack>
        <HStack className="gap-x-3 items-center">
          {hasBalance && (
            <Text
              className={cn(
                "text-lg font-medium",
                isNegative && "text-error-400"
              )}
              numberOfLines={1}
            >
              {amountText}
            </Text>
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
