import AppAvatar from "@/components/AppAvatar";
import FormButton from "@/components/FormButton";
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
import { useEffect, useState } from "react";

type PayerSelectionActionSheetProps = {
  isOpen: boolean;
  members: Member[];
  currentPayer: Member | null;
  onClose: () => void;
  onSave: (payer: Member) => void;
};

export function PayerSelectionActionSheet({
  isOpen,
  members,
  currentPayer,
  onClose,
  onSave
}: PayerSelectionActionSheetProps) {
  const [selectedId, setSelectedId] = useState(currentPayer?.id ?? "");

  useEffect(() => {
    if (isOpen) setSelectedId(currentPayer?.id ?? "");
  }, [isOpen]);

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[90]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full p-4 flex-1 gap-y-4">
          <Text bold className="text-xl">
            Select Payer
          </Text>
          <RadioGroup
            className="flex-1"
            value={selectedId}
            onChange={setSelectedId}
          >
            <FlatList
              className="flex-1"
              data={members}
              renderItem={({ item }) => (
                <PayerItem
                  member={item}
                  onPress={() => setSelectedId(item.id)}
                />
              )}
              keyExtractor={(item) => item.id}
              ItemSeparatorComponent={() => (
                <Divider className="border-secondary-200" />
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
              disabled={!selectedId}
              onPress={() => {
                const payer = members.find((m) => m.id === selectedId);
                if (payer) onSave(payer);
                onClose();
              }}
            />
          </HStack>
        </Box>
      </ActionsheetContent>
    </Actionsheet>
  );
}

function PayerItem({
  member,
  onPress
}: {
  member: Member;
  onPress: () => void;
}) {
  const { details: currentUser } = states.user();
  const isCurrentUser = member.id === currentUser?.id;
  const fullName = `${member.first_name} ${member.last_name ?? ""}`.trim();

  return (
    <Radio
      value={member.id}
      size="lg"
      className="justify-between"
      onPress={onPress}
    >
      <HStack className="flex-1 items-center gap-x-2">
        <AppAvatar name={fullName} uri={member.avatar ?? ""} />
        <VStack className="gap-y-4 py-4">
          <VStack>
            <HStack className="gap-x-1 items-center">
              <Text className="text-lg">
                {fullName} {isCurrentUser && "(You)"}
              </Text>
            </HStack>
            <Text className="text-sm text-secondary-950">{member.email}</Text>
          </VStack>
        </VStack>
      </HStack>
      <RadioIndicator>
        <RadioIcon as={CircleIcon} />
      </RadioIndicator>
    </Radio>
  );
}
