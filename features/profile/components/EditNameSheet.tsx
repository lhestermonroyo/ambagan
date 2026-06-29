import FormButton from "@/components/FormButton";
import FormInput from "@/components/FormInput";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import useAppToast from "@/hooks/use-app-toast";
import { useEnsureOnline } from "@/hooks/useEnsureOnline";
import services from "@/services";
import states from "@/states";
import { User } from "@/types/user";
import { useState } from "react";

export default function EditNameSheet({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { details: userDetails } = states.user();
  const toast = useAppToast();
  const ensureOnline = useEnsureOnline();

  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState({
    first_name: userDetails?.first_name || "",
    last_name: userDetails?.last_name || ""
  });

  const handleSubmit = async () => {
    if (!values.first_name.trim() || !values.last_name.trim()) {
      toast({
        title: "Validation Error",
        description: "First name and last name are required.",
        type: "error"
      });
      return;
    }

    if (!(await ensureOnline("Updating your name needs an internet connection.")))
      return;

    setSubmitting(true);

    try {
      const response = await services.user.updateUser({
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim()
      });

      states.user.setState((prev) => ({
        ...prev,
        details: response.data as User
      }));

      toast({
        title: "Name Updated",
        description: "Your name has been updated successfully.",
        type: "success"
      });
      onClose();
    } catch (error) {
      console.error("Error updating name:", error);
      toast({
        title: "Error",
        description: "Failed to update your name. Please try again.",
        type: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[60]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full flex-1">
          <VStack className="p-4">
            <Text bold className="text-xl">
              Edit Name
            </Text>
          </VStack>
          <VStack className="gap-y-4 flex-1 p-4">
            <FormInput
              label="First Name"
              placeholder="Juan"
              value={values.first_name}
              onChangeText={(text) =>
                setValues({ ...values, first_name: text })
              }
              autoCapitalize="words"
            />
            <FormInput
              label="Last Name"
              placeholder="Dela Cruz"
              value={values.last_name}
              onChangeText={(text) => setValues({ ...values, last_name: text })}
              autoCapitalize="words"
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
      </ActionsheetContent>
    </Actionsheet>
  );
}
