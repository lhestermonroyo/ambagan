import { default as Avatar } from "@/components/AppAvatar";
import Icon from "@/components/Icon";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import states from "@/states";
import { UserPreview } from "@/types/user";
import { Pressable } from "react-native";

export default function SelectedMemberItem({
  member,
  disabled,
  onRemoveMember
}: {
  member: UserPreview;
  disabled?: boolean;
  onRemoveMember: () => void;
}) {
  const user = states.user();
  const { details: userDetails } = user;

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
            size="lg"
            className="rounded-full"
          />
        </Box>
        <VStack className="items-center gap-y-0">
          <Text className="text-center break-words">
            {member.first_name} {member.last_name}
            {isMe && " (You)"}
          </Text>
        </VStack>
      </VStack>
    </Pressable>
  );
}
