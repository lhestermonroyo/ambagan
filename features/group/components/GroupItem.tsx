import AppAvatar from "@/components/AppAvatar";
import AppAvatarGroup from "@/components/AppAvatarGroup";
import Icon from "@/components/Icon";
import PressableListItem from "@/components/PressableListItem";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import states from "@/states";
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
  const { details: userDetails } = states.user();
  const isAdmin = details.admin?.id === userDetails?.id;

  const appAvatarGroupItems = useMemo(
    () =>
      details.members.map((item) => ({
        id: item.id,
        name: `${item.first_name} ${item.last_name}`,
        uri: item.avatar || undefined
      })),
    [details.members]
  );

  return (
    <PressableListItem className="p-4" onPress={onOpen}>
      <HStack className="items-center gap-x-2">
        <AppAvatar name={details.name} uri={details.avatar || undefined} />
        <VStack className="flex-1">
          <Text className="text-lg" numberOfLines={2} ellipsizeMode="tail">
            {details.name}
          </Text>
          <HStack className="gap-x-1 items-center">
            <Text className="text-secondary-950">
              {isAdmin ? "Created" : "Joined"} {formatDate(details.created_at)}
            </Text>
          </HStack>
        </VStack>
        <HStack className="gap-x-2 items-center">
          <AppAvatarGroup
            size="sm"
            items={appAvatarGroupItems}
            maxDisplay={3}
          />
          <Icon as="chevron-right" className="text-secondary-950" />
        </HStack>
      </HStack>
    </PressableListItem>
  );
}
