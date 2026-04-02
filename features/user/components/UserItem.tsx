import AppAvatar from "@/components/AppAvatar";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Member } from "@/types/groups";
import { ReactNode } from "react";

export default function UserItem({
  item,
  isCreator,
  isMe,
  action
}: {
  item: Member;
  isCreator: boolean;
  isMe: boolean;
  action: ReactNode[];
}) {
  return (
    <VStack className="px-4">
      <VStack className="flex-1 gap-y-4 py-4">
        <HStack className="items-center">
          <HStack className="gap-x-2 items-center flex-1">
            <AppAvatar name={item?.first_name} uri={item?.avatar!} size="md" />
            <VStack>
              <HStack className="gap-x-1 items-center">
                <Text className="text-lg">
                  {item?.first_name} {item?.last_name}
                </Text>
                {isMe && "(Me)"}
                {isCreator && "(Creator)"}
              </HStack>
              <Text className="text-secondary-950">{item?.email}</Text>
            </VStack>
          </HStack>
        </HStack>
      </VStack>
      {action.length && (
        <HStack className="gap-x-2 items-center">{action}</HStack>
      )}
    </VStack>
  );
}
