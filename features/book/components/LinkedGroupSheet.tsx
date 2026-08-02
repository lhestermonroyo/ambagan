import AppAvatar from "@/components/AppAvatar";
import AppSheet from "@/components/AppSheet";
import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import {
  Radio,
  RadioGroup,
  RadioIcon,
  RadioIndicator
} from "@/components/ui/radio";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { EmptyType } from "@/types/general";
import { Group } from "@/types/groups";
import { formatDate } from "@/utils/formatDate";
import { CircleIcon } from "lucide-react-native";
import { useState } from "react";

/** Sentinel for the "not linked" row — RadioGroup values have to be strings. */
const NONE = "__none__";

/**
 * "Which group does this book roll up with?" — the book form's linked-group
 * picker.
 *
 * Deliberately NOT the expense form's GroupSelectionActionSheet: that one filters
 * to groups with enough members to hold an expense, which is the wrong rule here
 * (a group you're the only member of so far is perfectly linkable), and it has no
 * way to express "none" since its contract is `onChangeGroup(group: Group)`.
 */
export default function LinkedGroupSheet({
  isOpen,
  onClose,
  groups,
  selectedGroupId,
  onSelect
}: {
  isOpen: boolean;
  onClose: () => void;
  /** The user's groups. Passed in so the caller controls loading/filtering. */
  groups: Group[];
  selectedGroupId: string | null;
  onSelect: (groupId: string | null) => void;
}) {
  const [selected, setSelected] = useState(selectedGroupId ?? NONE);

  return (
    <AppSheet
      isOpen={isOpen}
      onClose={onClose}
      footer={
        <Box className="sticky bottom-0 w-full p-4">
          {/* HStack, not the Box alone: `flex-1` in a column parent with no
              height stretches the button to nothing. Same shape as the expense
              form's group picker. */}
          <HStack className="gap-x-2">
            <FormButton
              text="Save Changes"
              className="flex-1"
              onPress={() => {
                onSelect(selected === NONE ? null : selected);
                onClose();
              }}
            />
          </HStack>
        </Box>
      }
    >
      <Pressable onPress={onClose}>
        <HStack className="items-center pt-4 px-4">
          <Icon as="arrow-back-ios" className="text-secondary-950" />
          <Text bold className="text-xl">
            Link to a Group
          </Text>
        </HStack>
      </Pressable>
      <Text className="text-sm text-secondary-950 px-4 pt-1 pb-2">
        Adds your share of that group&apos;s expenses to this book&apos;s total,
        so you can see what a trip or a month really cost you. Your personal
        expenses stay private — no one else in the group can see them.
      </Text>

      <RadioGroup
        className="flex-1 px-4"
        value={selected}
        onChange={(value) => setSelected(value)}
      >
        <FlatList
          className="flex-1"
          data={groups}
          keyExtractor={(item) => (item as Group).id}
          ListHeaderComponent={
            <>
              <Radio
                value={NONE}
                size="md"
                className="justify-between py-4"
                onPress={() => setSelected(NONE)}
              >
                <VStack className="flex-1">
                  <Text className="text-lg">Not linked</Text>
                  <Text className="text-sm text-secondary-950">
                    Keep this book standalone.
                  </Text>
                </VStack>
                <RadioIndicator>
                  <RadioIcon as={CircleIcon} />
                </RadioIndicator>
              </Radio>
              <Divider className="border-secondary-200" />
            </>
          }
          renderItem={({ item }) => {
            const group = item as Group;
            return (
              <Radio
                value={group.id}
                size="md"
                className="justify-between"
                onPress={() => setSelected(group.id)}
              >
                <HStack className="flex-1 items-center gap-x-3">
                  <AppAvatar name={group.name} uri={group.avatar || ""} />
                  <VStack className="py-4">
                    <Text className="text-lg">{group.name}</Text>
                    <Text className="text-sm text-secondary-950">
                      {formatDate(group.created_at)}
                    </Text>
                  </VStack>
                </HStack>
                <RadioIndicator>
                  <RadioIcon as={CircleIcon} />
                </RadioIndicator>
              </Radio>
            );
          }}
          ItemSeparatorComponent={() => (
            <Divider className="border-secondary-200" />
          )}
          ListEmptyComponent={() => <EmptyList type={EmptyType.GROUP} />}
        />
      </RadioGroup>
    </AppSheet>
  );
}
