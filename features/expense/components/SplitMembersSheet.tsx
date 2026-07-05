import AppAvatar from "@/components/AppAvatar";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import ListDivider from "@/components/ListDivider";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import states from "@/states";
import { Member } from "@/types/groups";
import { getUserSubtitle } from "@/utils/userDisplay";
import { Fragment, useEffect, useState } from "react";

/**
 * Checklist sheet for picking which members share an expense. Checked members
 * are included in the split; unchecked ones are excluded. Selection is kept in
 * local state so Cancel discards; only "Done" commits via onSave.
 *
 * Note: selection is driven by a plain Set rather than gluestack's
 * CheckboxGroup — its controlled-value ref is unreliable on React Native (see
 * MembersSelectionSheet), so we render Material-icon checkboxes ourselves.
 */
export default function SplitMembersSheet({
  isOpen,
  onClose,
  members,
  includedIds,
  onSave
}: {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  includedIds: Set<string>;
  onSave: (nextIncludedIds: Set<string>) => void;
}) {
  if (!includedIds) {
    return null;
  }

  const { details: userDetails } = states.user();
  const [selected, setSelected] = useState<Set<string>>(new Set(includedIds));

  // Re-seed from the source of truth each open so in-sheet toggles are
  // discarded when the user cancels.
  useEffect(() => {
    if (isOpen) setSelected(new Set(includedIds));
  }, [isOpen]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = members.length > 0 && selected.size === members.length;

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(members.map((m) => m.id)));
  };

  const handleSave = () => {
    onSave(selected);
    onClose();
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[90]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full flex-1">
          <Pressable onPress={onClose}>
            <HStack className="p-4 items-center">
              <Icon as="arrow-back-ios" className="text-secondary-950" />
              <Text bold className="text-xl">
                Split among
              </Text>
            </HStack>
          </Pressable>
          <Text className="text-sm text-secondary-950 px-4 pb-4">
            Pick who shares this expense. Unchecked members are excluded from the
            split.
          </Text>

          <HStack className="items-center px-4 pb-4">
            <Text className="text-sm text-secondary-950 flex-1">
              {selected.size} of {members.length} selected
            </Text>
            <Pressable onPress={toggleAll}>
              <Text className="text-primary-400">
                {allSelected ? "Unselect all" : "Select all"}
              </Text>
            </Pressable>
          </HStack>

          <ScrollView className="flex-1">
            <VStack>
              {members.map((item, index) => {
                const isMe = item.id === userDetails?.id;
                const checked = selected.has(item.id);

                return (
                  <Fragment key={item.id}>
                    {index > 0 && <ListDivider />}
                    <Pressable onPress={() => toggle(item.id)}>
                      <HStack className="items-center gap-x-3 px-4 py-3">
                        <AppAvatar
                          name={item.first_name}
                          uri={item.avatar || ""}
                          isPlaceholder={item.is_placeholder}
                        />
                        <VStack className="flex-1">
                          <Text className="text-lg">
                            {item.first_name} {item.last_name}
                            {isMe && " (You)"}
                          </Text>
                          <Text className="text-sm text-secondary-950">
                            {getUserSubtitle(item)}
                          </Text>
                        </VStack>
                        <Icon
                          as={checked ? "check-box" : "check-box-outline-blank"}
                          className={
                            checked ? "text-primary-400" : "text-secondary-400"
                          }
                        />
                      </HStack>
                    </Pressable>
                  </Fragment>
                );
              })}
            </VStack>
          </ScrollView>
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
              text="Done"
              disabled={selected.size < 1}
              onPress={handleSave}
            />
          </HStack>
        </Box>
      </ActionsheetContent>
    </Actionsheet>
  );
}
