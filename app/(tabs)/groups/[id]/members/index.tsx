import AppAvatar from "@/components/AppAvatar";
import AppBadge from "@/components/AppBadge";
import Icon from "@/components/Icon";
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import MembersSelection from "@/features/group/components/MembersSelection";
import InnerLayout from "@/layouts/InnerLayout";
import states from "@/states";
import { Member } from "@/types/groups";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Fragment, useMemo, useState } from "react";

export default function MembersPage() {
  const params = useLocalSearchParams();
  const router = useRouter();

  const [isMembersSelectionOpen, setIsMembersSelectionOpen] = useState(false);

  const user = states.user.getState();
  const group = states.group.getState();
  const creatorId = group.details?.creator?.id;

  const [searchInput, setSearchInput] = useState("");
  const [searching, setSearching] = useState(false);

  const filteredMembers = useMemo(() => {
    if (!searchInput.trim()) return group.details?.members || [];

    const lower = searchInput.toLowerCase();
    return (group.details?.members || []).filter(
      (m) =>
        m.first_name.toLowerCase().includes(lower) ||
        m.last_name.toLowerCase().includes(lower) ||
        m.email?.toLowerCase().includes(lower)
    );
  }, [searchInput, group.details?.members]);

  return (
    <Fragment>
      <InnerLayout
        title="Members"
        onBack={() => router.push(`/groups/${params.id}`)}
        actions={[
          <Button
            variant="link"
            className="rounded-full"
            onPress={() => setIsMembersSelectionOpen(true)}
          >
            <Icon as="person-add" size={28} className="text-secondary-950" />
          </Button>
        ]}
      >
        <VStack className="px-4">
          <MembersSelection
            isOpen={isMembersSelectionOpen}
            onClose={() => setIsMembersSelectionOpen(false)}
            onSaveMembers={() => {}}
          />
        </VStack>
      </InnerLayout>
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
    <VStack className="px-4">
      <VStack className={`flex-1 gap-y-4 py-4`}>
        <HStack className="items-center">
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
              <Text className="text-secondary-950">{item?.email}</Text>
            </VStack>
          </HStack>
        </HStack>
      </VStack>
    </VStack>
  );
}
