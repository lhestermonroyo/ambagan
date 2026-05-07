import AppAvatar from "@/components/AppAvatar";
import Icon from "@/components/Icon";
import PressableListItem from "@/components/PressableListItem";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import { FriendSummary } from "@/types/expenses";
import { cn } from "@gluestack-ui/utils/nativewind-utils";

export default function FriendItem({
  item,
  onPress
}: {
  item: FriendSummary;
  onPress: (item: FriendSummary) => void;
}) {
  const { friend, balances } = item;
  const [primary, ...rest] = balances;
  const isNegative = (primary?.amount ?? 0) < 0;

  return (
    <PressableListItem className="p-4" onPress={() => onPress(item)}>
      <HStack className="gap-x-3 items-center">
        <AppAvatar
          name={`${friend.first_name} ${friend.last_name}`}
          uri={friend.avatar || undefined}
        />
        <VStack className="flex-1">
          <Text className="text-lg">
            {friend.first_name} {friend.last_name}
          </Text>
          <Text className="text-secondary-950">{friend.email}</Text>
        </VStack>
        <HStack className="gap-x-2 items-center">
          <HStack className="gap-x-1 items-center">
            <Text className={cn("text-lg", isNegative && "text-error-400")}>
              {primary
                ? `${isNegative ? "-" : ""}${formatAmount(Math.abs(primary.amount), primary.currency)}`
                : "-"}
            </Text>
            {rest.length > 0 && (
              <Box className="bg-primary-400 rounded-full h-5 w-5 items-center justify-center">
                <Text className="text-background-0 text-xs font-semibold">
                  +{rest.length}
                </Text>
              </Box>
            )}
          </HStack>
          <Icon as="chevron-right" className="text-secondary-950" />
        </HStack>
      </HStack>
    </PressableListItem>
  );
}
