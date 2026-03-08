import AppAvatar from "@/components/AppAvatar";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
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
import { Group } from "@/types/groups";
import formatDate from "@/utils/formatDate";
import { useRouter } from "expo-router";
import { CircleIcon } from "lucide-react-native";
import { Fragment, useState } from "react";
import { Pressable } from "react-native";

export default function GroupSelection({
  group,
  onChangeGroup,
  isLocked = false
}: {
  group: Group | null;
  onChangeGroup: (group: Group) => void;
  isLocked?: boolean;
}) {
  const [openActionsheet, setOpenActionsheet] = useState(false);

  const router = useRouter();

  if (!group)
    return (
      <Pressable
        className="p-4 bg-background-0 border border-background-200 rounded-2xl"
        onPress={() => router.push("/groups/create")}
      >
        <HStack className="gap-x-4 justify-center items-center">
          <VStack className="flex-1 gap-y-4">
            <VStack>
              <Text className="text-xl">No group created yet.</Text>
              <Text className="text-secondary-950">
                Group is required to add expenses. Create a group to start
                adding expenses and sharing with friends.
              </Text>
            </VStack>
          </VStack>
          <Icon as="group-add" />
        </HStack>
      </Pressable>
    );

  return (
    <Fragment>
      <Pressable
        className="p-4 bg-background-0 border border-background-200 rounded-2xl"
        disabled={isLocked}
        onPress={() => setOpenActionsheet(true)}
      >
        <HStack className="gap-x-4 justify-center items-center">
          <VStack className="flex-1 gap-y-4">
            <HStack className="gap-x-2">
              <AppAvatar name={group.name} uri={group.avatar || ""} />
              <VStack>
                <Text className="text-lg">{group.name}</Text>
                <Text className="text-secondary-950">
                  Joined {formatDate(group.created_at)}
                </Text>
              </VStack>
            </HStack>
          </VStack>
          {!isLocked && (
            <Icon as="unfold-more" className="text-secondary-950" />
          )}
        </HStack>
      </Pressable>
      <GroupSelectionActionSheet
        isOpen={openActionsheet}
        onClose={() => setOpenActionsheet(false)}
        onChangeGroup={onChangeGroup}
        currentGroup={group}
      />
    </Fragment>
  );
}

function GroupSelectionActionSheet({
  isOpen,
  onClose,
  currentGroup,
  onChangeGroup
}: {
  isOpen: boolean;
  onClose: () => void;
  currentGroup: Group;
  onChangeGroup: (group: Group) => void;
}) {
  const [selectedGroup, setSelectedGroup] = useState(currentGroup.id);

  const group = states.group.getState();

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
              Select Group to Add Expense
            </Text>
            <RadioGroup
              value={selectedGroup.toString()}
              onChange={(value) => {
                setSelectedGroup(value);
              }}
            >
              {group.groups.map((item, index) => (
                <Radio
                  key={item.id}
                  value={item.id.toString()}
                  size="lg"
                  className={`justify-between ${index !== group.groups.length - 1 && "border-b border-background-200"}`}
                >
                  <HStack className="flex-1 items-center gap-x-2">
                    <AppAvatar name={item.name} uri={item.avatar || ""} />
                    <VStack className="gap-y-4 py-4">
                      <VStack>
                        <Text className="text-lg">{item?.name}</Text>
                        <Text className="text-secondary-950">
                          Joined {formatDate(item?.created_at)}
                        </Text>
                      </VStack>
                    </VStack>
                  </HStack>
                  <RadioIndicator>
                    <RadioIcon as={CircleIcon} />
                  </RadioIndicator>
                </Radio>
              ))}
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
                text="Save Group"
                disabled={!selectedGroup}
                onPress={() => {
                  const newGroup = group.groups.find(
                    (g) => g.id.toString() === selectedGroup
                  );
                  if (newGroup) onChangeGroup(newGroup);
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
