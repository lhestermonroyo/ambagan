import FormButton from "@/components/FormButton";
import FormInput from "@/components/FormInput";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import KeyboardAvoidingSheet from "@/components/KeyboardAvoidingSheet";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import useAppToast from "@/hooks/use-app-toast";
import services from "@/services";
import states from "@/states";
import { User } from "@/types/user";
import { formatPhoneInput, parsePhoneInput } from "@/utils/formatPhone";
import { useState } from "react";

export default function EditPhoneSheet({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { details: userDetails } = states.user();
  const toast = useAppToast();

  const [phone, setPhone] = useState(userDetails?.phone || "");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const digits = parsePhoneInput(phone);

    if (digits.length !== 10) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid 10-digit Philippine phone number.",
        type: "error"
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await services.user.updatePhone(digits);

      states.user.setState((prev) => ({
        ...prev,
        details: response.data as User
      }));

      toast({
        title: "Phone Updated",
        description: "Your phone number has been updated successfully.",
        type: "success"
      });
      onClose();
    } catch (error) {
      console.error("Error updating phone:", error);
      toast({
        title: "Error",
        description: "Failed to update your phone number. Please try again.",
        type: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[50]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <KeyboardAvoidingSheet>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full flex-1">
          <VStack className="p-4">
            <Text bold className="text-xl">
              Edit Phone Number
            </Text>
          </VStack>
          <VStack className="gap-y-4 flex-1 p-4">
            <FormInput
              type="text"
              label="Phone Number"
              placeholder="9XX XXX XXXX"
              keyboardType="phone-pad"
              value={formatPhoneInput(phone)}
              onChangeText={(text) => setPhone(parsePhoneInput(text))}
              leftAddon="+63"
              autoCapitalize="none"
            />
          </VStack>
        </VStack>
        <Box className="p-4 w-full">
          <HStack className="gap-x-2">
            <FormButton
              className="flex-1"
              variant="outline"
              text="Cancel"
              disabled={submitting}
              onPress={onClose}
            />
            <FormButton
              className="flex-1"
              text="Save Changes"
              loading={submitting}
              onPress={handleSubmit}
            />
          </HStack>
        </Box>
        </KeyboardAvoidingSheet>
      </ActionsheetContent>
    </Actionsheet>
  );
}
