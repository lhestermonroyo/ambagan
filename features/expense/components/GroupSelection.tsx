import AppAvatar from "@/components/AppAvatar";
import EmptyList from "@/components/EmptyList";
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
import { Group } from "@/types/groups";
import { EmptyType } from "@/types/general";
import { formatDate } from "@/utils/formatDate";
import { useRouter } from "expo-router";
import { CircleIcon } from "lucide-react-native";
import { Fragment, useState } from "react";
import ListDivider from "@/components/ListDivider";

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
      <PressableListItem
        className="p-4 border border-background-200 rounded-lg"
        onPress={() => router.push("/groups/create")}
      >
        <HStack className="gap-x-4 justify-center items-center">
          <VStack className="flex-1 gap-y-4">
            <VStack>
              <Text className="text-lg">No group created yet.</Text>
              <Text className="text-secondary-950 text-sm">
                Group is required to add expenses. Create a group to start
                adding expenses and sharing with friends.
              </Text>
            </VStack>
          </VStack>
          <Icon as="group-add" className="text-primary-400" />
        </HStack>
      </PressableListItem>
    );

  return (
    <Fragment>
      {isLocked ? (
        <Box className="p-4 border border-background-200 rounded-lg">
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
          </HStack>
        </Box>
      ) : (
        <PressableListItem
          className="p-4 border border-background-200 rounded-lg"
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
            <Icon as="unfold-more" className="text-secondary-950" />
          </HStack>
        </PressableListItem>
      )}

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

  const { list: groupList } = states.group.getState();

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[90]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full p-4 flex-1 gap-y-4">
          <Text bold className="text-xl">
            Select Group to Add Expense
          </Text>
          <RadioGroup
            className="flex-1"
            value={selectedGroup.toString()}
            onChange={(value) => {
              setSelectedGroup(value);
            }}
          >
            <FlatList
              className="flex-1"
              data={groupList}
              renderItem={({ item }) => (
                <GroupItem
                  group={item}
                  onPress={() => setSelectedGroup(item.id.toString())}
                />
              )}
              keyExtractor={(item) => item.id.toString()}
              ItemSeparatorComponent={ListDivider}
              ListEmptyComponent={() => <EmptyList type={EmptyType.GROUP} />}
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
              text="Save Group"
              disabled={!selectedGroup}
              onPress={() => {
                const newGroup = groupList.find(
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
  );
}

function GroupItem({ group, onPress }: { group: Group; onPress: () => void }) {
  return (
    <Radio
      key={group.id}
      value={group.id.toString()}
      size="lg"
      className="justify-between"
      onPress={onPress}
    >
      <HStack className="flex-1 items-center gap-x-2">
        <AppAvatar name={group.name} uri={group.avatar || ""} />
        <VStack className="gap-y-4 py-4">
          <VStack>
            <Text className="text-lg">{group?.name}</Text>
            <Text className="text-secondary-950 text-sm">
              Joined {formatDate(group?.created_at)}
            </Text>
          </VStack>
        </VStack>
      </HStack>
      <RadioIndicator>
        <RadioIcon as={CircleIcon} />
      </RadioIndicator>
    </Radio>
  );
}
