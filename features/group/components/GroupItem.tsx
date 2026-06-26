import AppAvatar from "@/components/AppAvatar";
import AppAvatarGroup from "@/components/AppAvatarGroup";
import Icon from "@/components/Icon";
import PressableListItem from "@/components/PressableListItem";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Group, Member } from "@/types/groups";
import { formatDate } from "@/utils/formatDate";
import { useMemo } from "react";

export default function GroupItem({
  details,
  onOpen
}: {
  details: Group & { members: Member[] };
  onOpen: () => void;
}) {
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
        <AppAvatar name={details.name} uri={details.avatar || undefined} />
        <VStack className="flex-1">
          <HStack className="items-center gap-x-2">
            <Text
              className="text-lg flex-shrink"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {details.name}
            </Text>
            {details.pending && (
              <Box className="bg-warning-50 dark:bg-warning-900 rounded-full px-2 py-0.5">
                <Text className="text-warning-600 text-2xs font-semibold uppercase">
                  Syncing…
                </Text>
              </Box>
            )}
          </HStack>
          <HStack className="gap-x-1 items-center">
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
