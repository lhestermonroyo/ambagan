import AppAvatar from "@/components/AppAvatar";
import Icon from "@/components/Icon";
import PressableListItem from "@/components/PressableListItem";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import states from "@/states";
import { Group } from "@/types/groups";
import { formatDate } from "@/utils/formatDate";

export default function GroupItem({
  details,
  onOpen
}: {
  details: Group;
  onOpen: () => void;
}) {
  const { details: userDetails } = states.user();
  const isCreator = details.creator?.id === userDetails?.id;

  return (
    <PressableListItem className="p-4" onPress={onOpen}>
      <HStack className="items-center gap-x-2">
        <AppAvatar name={details.name} uri={details.avatar || ""} />
        <VStack className="flex-1">
          <Text className="text-lg" numberOfLines={2} ellipsizeMode="tail">
            {details.name}
          </Text>
          <HStack className="gap-x-1 items-center">
            <Text className="text-secondary-950 text-sm">
              {isCreator ? "Created" : "Joined"}{" "}
              {formatDate(details.created_at)} &bull; {details.members_count}{" "}
              {details.members_count === 1 ? "member" : "members"}
            </Text>
          </HStack>
        </VStack>
        <HStack className="gap-x-2 items-center">
          <Icon as="chevron-right" className="text-secondary-950" />
        </HStack>
      </HStack>
    </PressableListItem>
  );
}
