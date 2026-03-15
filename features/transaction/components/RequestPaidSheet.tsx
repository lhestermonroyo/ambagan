import FormButton from "@/components/FormButton";
import FormTextarea from "@/components/FormTextarea";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import UploadImage from "@/components/UploadImage";
import states from "@/states";
import { MemberSplit } from "@/types/transactions";
import { ImagePickerSuccessResult } from "expo-image-picker";
import { useState } from "react";

export default function RequestPaidSheet({
  isOpen,
  onClose,
  splitMember
}: {
  isOpen: boolean;
  onClose: () => void;
  splitMember: MemberSplit;
}) {
  const [values, setValues] = useState({
    note: "Paid with thanks! 😊",
    receipt: null as ImagePickerSuccessResult | null
  });

  const group = states.group.getState();
  const user = states.user.getState();

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[80]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full p-4 flex-1 gap-6">
          <Text bold className="text-xl">
            Request as Paid
          </Text>
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            <VStack className="gap-y-6">
              <FormTextarea
                label="Note (optional)"
                placeholder="Enter note (e.g., Paid with thanks! 😊)"
                value={values.note}
                onChangeText={(text) => setValues({ ...values, note: text })}
                autoCapitalize="none"
              />

              <VStack className="gap-y-1">
                <UploadImage
                  title="Upload Proof of Payment (optional)"
                  onSelect={(result) =>
                    setValues({ ...values, receipt: result })
                  }
                />
                <Text className="text-secondary-950 text-sm">
                  Proof could be a photo of receipt, screenshot of online
                  payment, or any document that shows the expense details.
                </Text>
              </VStack>
            </VStack>
          </ScrollView>
        </VStack>
        <Box className="items-center justify-start sticky bottom-0 px-4">
          <Box className="h-4" />
          <HStack className="gap-x-2 pt-4">
            <FormButton
              className="flex-1"
              variant="outline"
              text="Cancel"
              onPress={onClose}
            />
            <FormButton className="flex-1" text="Confirm Request" />
          </HStack>
        </Box>
      </ActionsheetContent>
    </Actionsheet>
  );
}
