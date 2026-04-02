import AppAvatar from "@/components/AppAvatar";
import Icon from "@/components/Icon";
import LoadingWrapper from "@/components/LoadingWrapper";
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
import services from "@/services";
import states from "@/states";
import { Member } from "@/types/groups";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Fragment, useEffect, useState } from "react";

export default function MembersScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const groupId = params.groupId as string | undefined;

  const [loading, setLoading] = useState(false);
  const [isEditMembersOpen, setIsEditMembersOpen] = useState(false);

  const user = states.user.getState();
  const group = states.group.getState();
  const { details: userDetails } = user;
  const { details: groupDetails } = group;

  useEffect(() => {
    if (!groupDetails?.id) {
      router.push("/groups");
      return;
    }

    fetchMembers(groupDetails.id);
  }, [groupDetails?.id]);

  const fetchMembers = async (groupId: string) => {
    setLoading(true);

    try {
      const response = await services.member.getMembersByGroupId(groupId);

      if (!response) return;

      states.group.setState((prev) => ({
        ...prev,
        details: prev.details
          ? { ...prev.details, members: response }
          : prev.details
      }));
    } catch (error) {
      console.error("Error fetching group members:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Fragment>
      <InnerLayout
        title="Members"
        onBack={() => router.push(`/groups/${groupId}`)}
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
        <LoadingWrapper isLoading={loading} text="Loading members...">
          <FlatList
            bounces={false}
            data={groupDetails?.members || []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MemberItem
                item={item}
                isCreator={item.id === groupDetails?.creator?.id}
                isYou={item.id === userDetails?.id}
              />
            )}
            ItemSeparatorComponent={() => (
              <Box className="mx-4">
                <Divider className="border-secondary-100" />
              </Box>
            )}
          />
        </LoadingWrapper>
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
      <HStack className="items-center">
        <HStack className="gap-x-2 items-center flex-1">
          <AppAvatar name={item?.first_name} uri={item?.avatar!} size="md" />
          <VStack>
            <HStack className="gap-x-1 items-center">
              <Text className="text-lg">
                {item?.first_name} {item?.last_name}
                {isYou && " (You)"}
                {isCreator && " (Creator)"}
              </Text>
            </HStack>
            <Text className="text-secondary-950 text-sm">{item?.email}</Text>
          </VStack>
        </HStack>
        <Icon as="chevron-right" size={24} className="text-secondary-950" />
      </HStack>
    </Pressable>
  );
}
