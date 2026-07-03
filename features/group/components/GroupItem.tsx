import AppAvatar from "@/components/AppAvatar";
import AppAvatarGroup from "@/components/AppAvatarGroup";
import Icon from "@/components/Icon";
import PressableListItem from "@/components/PressableListItem";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import states from "@/states";
import { Group, Member } from "@/types/groups";
import { formatDate } from "@/utils/formatDate";
import { getSecondaryHex } from "@/utils/getColorHex";
import { UserStar } from "lucide-react-native";
import { useMemo } from "react";
import { useColorScheme } from "react-native";

export default function GroupItem({
  details,
  onOpen
}: {
  details: Group & { members: Member[] };
  onOpen: () => void;
}) {
  const { details: userDetails } = states.user();
  const isCreator = details.admin.id === userDetails?.id;

  if (!details && !userDetails) {
    return;
  }

  const colorScheme = useColorScheme() ?? "light";

  const appAvatarGroupItems = useMemo(
    () =>
      details.members.map((item) => ({
        id: item.id,
        name: item.first_name,
        uri: item.avatar || undefined
      })),
    [details.members]
  );

  return (
    <PressableListItem className="p-4" onPress={onOpen}>
      <HStack className="items-center gap-x-2">
        <Box className="relative">
          {isCreator && (
            <Box className="absolute right-0 bottom-0 z-10 bg-primary-600 rounded-full p-1">
              <UserStar
                size={12}
                color={getSecondaryHex("text-secondary-0", colorScheme)}
              />
            </Box>
          )}
          <AppAvatar name={details.name} uri={details.avatar || undefined} />
        </Box>
        <VStack className="flex-1">
          <Text
            className="text-lg flex-shrink"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {details.name}
          </Text>
          <HStack className="gap-x-1 items-center">
            {details.pending && (
              <Icon as="sync" size={14} className="text-primary-400" />
            )}
            <Text className="text-sm text-secondary-950">
              {formatDate(details.created_at)} &bull;{" "}
              {details.expense_count ?? 0} expense
              {(details.expense_count ?? 0) !== 1 ? "s" : ""}
            </Text>
          </HStack>
        </VStack>
        <HStack className="gap-x-2 items-center">
          <AppAvatarGroup
            size="sm"
            items={appAvatarGroupItems}
            maxDisplay={2}
          />
          <Icon as="chevron-right" className="text-secondary-950" />
        </HStack>
      </HStack>
    </PressableListItem>
  );
}
