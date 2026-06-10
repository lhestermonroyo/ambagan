import AppAvatar from "@/components/AppAvatar";
import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import states from "@/states";
import { EmptyType } from "@/types/general";
import { Member } from "@/types/groups";
import { categories } from "@/utils/constants";
import { formatDate } from "@/utils/formatDate";
import React, { Fragment, useMemo, useState } from "react";
import EditMembersSheet from "./EditMemberSheet";

export default function GroupDetailsTab() {
  const { details, memberList } = states.group.getState();

  if (!details) return null;

  const [isEditMembersOpen, setIsEditMembersOpen] = useState(false);
  const [tab, setTab] = useState<"members" | "admin">("members");

  const { details: userDetails } = states.user();

  const categoryLabel = useMemo(() => {
    if (!details) return null;
    const category = categories.find((c) => c.value === details.category);
    return category ? category.label : null;
  }, [details?.category]);

  const filteredMemberList = useMemo(() => {
    if (!details) return [];

    if (tab === "members") {
      return memberList.filter((m) => m.id !== details.admin.id);
    } else {
      return memberList.filter((m) => m.id === details.admin.id);
    }
  }, [memberList, tab, details]);

  return (
    <Fragment>
      <VStack className="gap-y-8 px-4">
        <Box className="bg-secondary-100 rounded-xl overflow-hidden">
          <DetailRow
            label="Admin"
            value={
              <HStack className="gap-x-1 items-center">
                <AppAvatar
                  name={details?.admin.first_name}
                  uri={details?.admin.avatar!}
                  size="sm"
                />
                <Text>
                  {`${details?.admin.first_name} ${details?.admin.last_name}`}
                  {details.admin.id === userDetails?.id && " (You)"}
                </Text>
              </HStack>
            }
          />
          <Box className="mx-4">
            <Divider className="border-secondary-200" />
          </Box>
          <DetailRow
            label="Created at"
            value={<Text>{formatDate(details?.created_at || "")}</Text>}
          />
          <Box className="mx-4">
            <Divider className="border-secondary-200" />
          </Box>
          <DetailRow
            label="Members"
            value={
              <Text>
                {memberList.length}{" "}
                {memberList.length === 1 ? "member" : "members"}
              </Text>
            }
          />
          <Box className="mx-4">
            <Divider className="border-secondary-200" />
          </Box>
          <DetailRow
            label="Category"
            value={
              <Box className="bg-secondary-500 rounded-lg px-3 py-2">
                <Text className="text-sm">{categoryLabel || "-"}</Text>
              </Box>
            }
          />
        </Box>

        <VStack className="gap-y-2">
          <HStack className="items-center gap-x-2">
            <Text bold className="text-xl flex-1">
              Members
            </Text>
            <Button variant="link" onPress={() => setIsEditMembersOpen(true)}>
              <Text className="text-primary-400 font-medium">Edit Members</Text>
            </Button>
          </HStack>

          <HStack className="gap-x-2">
            <FormButton
              text="Members"
              size="sm"
              variant={tab === "members" ? "solid" : "outline"}
              className="flex-1"
              onPress={() => setTab("members")}
            />
            <FormButton
              text="Admin"
              size="sm"
              variant={tab === "admin" ? "solid" : "outline"}
              className="flex-1"
              onPress={() => setTab("admin")}
            />
          </HStack>

          <FlatList
            scrollEnabled={false}
            data={filteredMemberList}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => <MemberItem item={item} />}
            ItemSeparatorComponent={() => (
              <Divider className="border-secondary-100" />
            )}
            ListEmptyComponent={() => <EmptyList type={EmptyType.MEMBER} />}
          />
        </VStack>
      </VStack>
      <EditMembersSheet
        isOpen={isEditMembersOpen}
        onClose={() => setIsEditMembersOpen(false)}
      />
    </Fragment>
  );
}

const DetailRow = ({
  label,
  value
}: {
  label: string;
  value: React.ReactNode;
}) => {
  return (
    <HStack className="items-center justify-between p-4">
      <Text className="text-secondary-950">{label}</Text>
      {value}
    </HStack>
  );
};

function MemberItem({ item }: { item: Member }) {
  const { details: userDetails } = states.user();
  const isYou = item.id === userDetails?.id;
  return (
    <HStack className="items-center py-4 gap-y-4">
      <HStack className="gap-x-2 items-center flex-1">
        <AppAvatar name={item?.first_name} uri={item?.avatar!} size="md" />
        <VStack>
          <HStack className="gap-x-1 items-center">
            <Text className="text-lg">
              {item?.first_name} {item?.last_name}
              {isYou && " (You)"}
            </Text>
          </HStack>
          <Text className="text-secondary-950">{item?.email}</Text>
        </VStack>
      </HStack>
    </HStack>
  );
}
