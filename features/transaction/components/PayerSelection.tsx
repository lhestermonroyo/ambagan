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
import { Member } from "@/types/groups";
import { CircleIcon } from "lucide-react-native";
import { Fragment, useState } from "react";
import { Pressable } from "react-native";

export default function PayerSelection({
  payer,
  members,
  onChangePayer
}: {
  payer: Member;
  members: Member[];
  onChangePayer: (payer: Member) => void;
}) {
  const [openActionsheet, setOpenActionsheet] = useState(false);

  return (
    <Fragment>
      <Pressable
        className="p-4 bg-background-0 border border-background-200 rounded-2xl"
        onPress={() => setOpenActionsheet(true)}
      >
        <HStack className="gap-x-4 justify-center items-center">
          <VStack className="flex-1 gap-y-4">
            <HStack className="gap-x-2">
              <AppAvatar name={payer?.first_name} uri={payer.avatar || ""} />
              <VStack>
                <Text className="text-lg">
                  {payer?.first_name} {payer?.last_name}
                </Text>
                <Text className="text-secondary-950">{payer?.email}</Text>
              </VStack>
            </HStack>
          </VStack>
          <Icon as="unfold-more" className="text-secondary-950" />
        </HStack>
      </Pressable>
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
  const [selectedPayer, setSelectedPayer] = useState(currentPayer.id);

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
              value={selectedPayer.toString()}
              onChange={(value) => {
                setSelectedPayer(value);
              }}
            >
              {members.map((item, index) => (
                <Radio
                  key={item.id}
                  value={item.id.toString()}
                  size="lg"
                  className={`justify-between ${index !== members.length - 1 && "border-b border-background-200"}`}
                >
                  <HStack className="flex-1 gap-x-2 items-center">
                    <AppAvatar
                      name={item?.first_name}
                      uri={item.avatar || ""}
                    />
                    <VStack className="gap-y-4 py-4">
                      <VStack>
                        <Text className="text-lg">
                          {item?.first_name} {item?.last_name}
                        </Text>
                        <Text className="text-secondary-950">
                          {item?.email}
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
