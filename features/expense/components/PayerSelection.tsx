import AppAvatar from "@/components/AppAvatar";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import PressableListItem from "@/components/PressableListItem";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import {
  Radio,
  RadioGroup,
  RadioIcon,
  RadioIndicator
} from "@/components/ui/radio";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import states from "@/states";
import { Member } from "@/types/groups";
import { CircleIcon } from "lucide-react-native";
import { Fragment, useMemo, useState } from "react";

export default function PayerSelection({
  payer,
  members,
  onChangePayer
}: {
  payer: Member;
  members: Member[];
  onChangePayer: (payer: Member) => void;
}) {
  const { details: userDetails } = states.user();
  const [openActionsheet, setOpenActionsheet] = useState(false);

  return (
    <Fragment>
      <PressableListItem
        className="p-4 border border-background-200 rounded-2xl"
        onPress={() => setOpenActionsheet(true)}
      >
        <HStack className="gap-x-4 justify-center items-center">
          <VStack className="flex-1 gap-y-4">
            <HStack className="gap-x-2">
              <AppAvatar name={payer?.first_name} uri={payer.avatar || ""} />
              <VStack>
                <HStack className="gap-x-1 items-center">
                  <Text className="text-lg">
                    {payer?.first_name} {payer?.last_name}
                    {userDetails?.id === payer.id && " (You)"}
                  </Text>
                </HStack>
                <Text className="text-secondary-950 text-sm">
                  {payer?.email}
                </Text>
              </VStack>
            </HStack>
          </VStack>
          <Icon as="unfold-more" className="text-secondary-950" />
        </HStack>
      </PressableListItem>
      <PayerSelectionActionSheet
        isOpen={openActionsheet}
        onClose={() => setOpenActionsheet(false)}
        onChangePayer={onChangePayer}
        currentPayer={payer}
        members={members}
      />
    </Fragment>
  );
}

function PayerSelectionActionSheet({
  isOpen,
  onClose,
  currentPayer,
  onChangePayer,
  members
}: {
  isOpen: boolean;
  onClose: () => void;
  currentPayer: Member;
  onChangePayer: (payer: Member) => void;
  members: Member[];
}) {
  const { details: userDetails } = states.user();
  const [selectedPayer, setSelectedPayer] = useState(currentPayer.id);

  const sortedMembers = useMemo(
    () =>
      members
        ? [
            ...members.filter((m) => m.id === userDetails?.id),
            ...members.filter((m) => m.id !== userDetails?.id)
          ]
        : [],
    [members, userDetails?.id]
  );

  return (
    <>
      <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[92]}>
        <ActionsheetBackdrop />
        <ActionsheetContent className="p-0">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <VStack className="w-full p-4 flex-1" space="xl">
            <Text bold className="text-xl">
              Select Who Paid for this Expense
            </Text>
            <RadioGroup
              className="flex-1"
              value={selectedPayer.toString()}
              onChange={(value) => {
                setSelectedPayer(value);
              }}
            >
              <FlatList
                className="flex-1"
                data={sortedMembers}
                renderItem={({ item }) => <MemberItem member={item} />}
                keyExtractor={(item) => item.id.toString()}
                ItemSeparatorComponent={() => (
                  <Box className="mx-4">
                    <Divider className="border-secondary-100" />
                  </Box>
                )}
              />
            </RadioGroup>
          </VStack>
          <Box className="sticky bottom-0 w-full px-4 pt-4">
            <HStack className="gap-x-2">
              <FormButton
                className="flex-1"
                variant="outline"
                text="Cancel"
                onPress={onClose}
              />
              <FormButton
                className="flex-1"
                text="Save Payer"
                disabled={!selectedPayer}
                onPress={() => {
                  const newPayer = members.find(
                    (m) => m.id.toString() === selectedPayer
                  );
                  if (newPayer) onChangePayer(newPayer);
                  onClose();
                }}
              />
            </HStack>
          </Box>
        </ActionsheetContent>
      </Actionsheet>
    </>
  );
}

function MemberItem({ member }: { member: Member }) {
  const { details: userDetails } = states.user();
  const isMe = userDetails?.id === member.id;

  return (
    <Radio
      key={member.id}
      value={member.id.toString()}
      size="lg"
      className="justify-between"
    >
      <HStack className="flex-1 gap-x-2 items-center">
        <AppAvatar name={member?.first_name} uri={member.avatar || ""} />
        <VStack className="gap-y-4 py-4">
          <VStack>
            <HStack className="gap-x-1 items-center">
              <Text className="text-lg">
                {member?.first_name} {member?.last_name}
                {isMe && " (You)"}
              </Text>
            </HStack>
            <Text className="text-secondary-950 text-sm">{member?.email}</Text>
          </VStack>
        </VStack>
      </HStack>
      <RadioIndicator>
        <RadioIcon as={CircleIcon} />
      </RadioIndicator>
    </Radio>
  );
}
