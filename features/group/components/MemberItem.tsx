import AppAvatar from "@/components/AppAvatar";
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import states from "@/states";
import { UserPreview } from "@/types/user";
import { getSecondaryHex } from "@/utils/getColorHex";
import { X } from "lucide-react-native";
import { useColorScheme } from "react-native";

export default function MemberItem({
  item,
  onRemove
}: {
  item: UserPreview;
  onRemove: () => void;
}) {
  const user = states.user();
  const { details: userDetails } = user;
  const colorScheme = useColorScheme() ?? "light";

  const isMe = item.id === userDetails?.id;

  return (
    <HStack key={item.id} className="py-4 items-center justify-between">
      <HStack className="gap-x-2 items-center flex-1">
        <AppAvatar name={item.first_name} uri={item.avatar!} size="md" />
        <VStack>
          <HStack className="gap-x-1 items-center">
            <Text className="text-lg">
              {item?.first_name} {item?.last_name}
              {isMe && " (You)"}
            </Text>
          </HStack>
          <Text className="text-secondary-950">{item?.email}</Text>
        </VStack>
      </HStack>
      {!isMe && (
        <Button variant="link" className="rounded-full" onPress={onRemove}>
          <X color={getSecondaryHex("text-secondary-950", colorScheme)} />
        </Button>
      )}
    </HStack>
  );
}
