import AppAvatar from "@/components/AppAvatar";
import AppBadge from "@/components/AppBadge";
import Icon from "@/components/Icon";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import EditMembersSheet from "@/features/group/components/EditMemberSheet";
import InnerLayout from "@/layouts/InnerLayout";
import states from "@/states";
import { Member } from "@/types/groups";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Fragment, useState } from "react";

export default function MembersPage() {
  const params = useLocalSearchParams();
  const router = useRouter();

  const [isEditMembersOpen, setIsEditMembersOpen] = useState(false);

  const user = states.user.getState();
  const group = states.group.getState();
  const creatorId = group.details?.creator?.id;

  return (
    <Fragment>
      <InnerLayout
        title="Members"
        onBack={() => router.push(`/groups/${params.id}`)}
        actions={[
          <Button
            variant="link"
            className="rounded-full"
            onPress={() => setIsEditMembersOpen(true)}
          >
            <Icon as="person-add" size={28} className="text-primary-400" />
          </Button>
        ]}
      >
        <FlatList
          data={group.details?.members || []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MemberItem
              item={item}
              isCreator={item.id === creatorId}
              isYou={item.id === user.details?.id}
            />
          )}
          ItemSeparatorComponent={() => (
            <Box className="mx-4">
              <Divider className="border-secondary-100" />
            </Box>
          )}
        />
      </InnerLayout>
      <EditMembersSheet
        isOpen={isEditMembersOpen}
        onClose={() => setIsEditMembersOpen(false)}
      />
    </Fragment>
  );
}

function MemberItem({
  item,
  isCreator,
  isYou
}: {
  item: Member;
  isCreator: boolean;
  isYou: boolean;
}) {
  return (
    <Pressable className="p-4 gap-y-4">
      <HStack className="items-center flex-1">
        <HStack className="gap-x-2 items-center flex-1">
          <AppAvatar name={item?.first_name} uri={item?.avatar!} size="md" />
          <VStack>
            <HStack className="gap-x-1 items-center">
              <Text className="text-lg">
                {item?.first_name} {item?.last_name}
              </Text>
              {isYou && <AppBadge text="You" />}
              {isCreator && <AppBadge text="Creator" />}
            </HStack>
            <Text className="text-secondary-950 text-sm">{item?.email}</Text>
          </VStack>
        </HStack>
        <Icon as="chevron-right" size={24} className="text-secondary-950" />
      </HStack>
    </Pressable>
  );
}
