import { default as Avatar } from "@/components/AppAvatar";
import Icon from "@/components/Icon";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import states from "@/states";
import { Member } from "@/types/groups";
import { Pressable } from "react-native";

export default function SelectedMemberItem({
  member,
  disabled,
  onRemoveMember
}: {
  member: Member;
  disabled?: boolean;
  onRemoveMember: () => void;
}) {
  const user = states.user.getState();
  const { details: userDetails } = user;

  const isCreator = member.id === userDetails?.id;
  const isMe = member.id === userDetails?.id;

  return (
    <Pressable
      key={member.id}
      style={{ maxWidth: 100 }}
      className="p-2"
      disabled={disabled}
      onPress={onRemoveMember}
    >
      <VStack className="relative justify-center items-center gap-y-2">
        <Box>
          {disabled ? (
            <Box className="absolute right-0 bottom-0 z-10 bg-primary-600 rounded-full p-1">
              <Icon as="lock-outline" size={12} className="text-background-0" />
            </Box>
          ) : (
            <Box className="absolute right-0 bottom-0 z-10 bg-background-100 rounded-full p-1">
              <Icon as="clear" size={12} className="text-secondary-950" />
            </Box>
          )}
          <Avatar
            name={member.first_name || ""}
            uri={member.avatar!}
            className="rounded-full p-1 bg-primary-400"
          />
        </Box>
        <VStack className="items-center gap-y-0">
          <Text className="text-center break-words">
            {member.first_name} {member.last_name}
            {isCreator && " (Creator)"}
          </Text>
        </VStack>
      </VStack>
    </Pressable>
  );
}
