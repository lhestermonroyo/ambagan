import AppAvatar from "@/components/AppAvatar";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import states from "@/states";
import { GroupDetails, Member } from "@/types/groups";
import { categories } from "@/utils/constants";
import { formatDate } from "@/utils/formatDate";
import React, { Fragment, useState } from "react";
import EditMembersSheet from "./EditMemberSheet";

export default function GroupDetailsTab({
  details
}: {
  details: GroupDetails | null;
}) {
  if (!details) {
    return (
      <Box className="p-4">
        <Text className="text-center text-secondary-950">
          No group details available.
        </Text>
      </Box>
    );
  }

  const [isEditMembersOpen, setIsEditMembersOpen] = useState(false);

  const { details: userDetails } = states.user.getState();

  return (
    <Fragment>
      <VStack className="gap-y-4">
        <VStack className="gap-y-4 px-4">
          <DetailItem
            label="Group Name"
            value={
              <Text className="flex-1 text-lg font-medium">
                {details?.name || "-"}
              </Text>
            }
          />
          <DetailItem
            label="Created"
            value={
              <Text className="flex-1 text-lg font-medium">
                {formatDate(details?.created_at || "")}
              </Text>
            }
          />
          <DetailItem
            label="Creator"
            value={
              <Text className="flex-1 text-lg font-medium">
                {`${details?.creator.first_name} ${details?.creator.last_name}`}
              </Text>
            }
          />
          <DetailItem
            label="Category"
            value={
              <Text className="text-sm self-start py-1 px-2 bg-primary-100 text-primary-800 rounded-full">
                {
                  categories.find((cat) => cat.value === details?.category)
                    ?.label
                }
              </Text>
            }
          />
        </VStack>

        <Box className="mx-4">
          <Divider className="border-secondary-100" />
        </Box>

        <VStack className="gap-y-2">
          <HStack className="items-center gap-x-2 px-4">
            <Text bold className="text-2xl flex-1">
              Members ({details?.members.length || 0})
            </Text>
            <FormButton
              text="Add"
              size="md"
              icon={<Icon as="person-add" className="text-background-0" />}
              onPress={() => setIsEditMembersOpen(true)}
            />
          </HStack>

          <FlatList
            bounces={false}
            scrollEnabled={false}
            data={details?.members || []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MemberItem
                item={item}
                isCreator={item.id === details?.creator?.id}
                isYou={item.id === userDetails?.id}
              />
            )}
            ItemSeparatorComponent={() => (
              <Box className="mx-4">
                <Divider className="border-secondary-100" />
              </Box>
            )}
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

const DetailItem = ({
  label,
  value
}: {
  label: string;
  value: React.ReactNode;
}) => {
  return (
    <VStack className="gap-y-1 w-full">
      <Text className="text-secondary-950 text-sm">{label}</Text>
      {value}
    </VStack>
  );
};

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
    <HStack className="items-center p-4 gap-y-4">
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
    </HStack>
  );
}
