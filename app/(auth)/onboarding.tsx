import FormButton from "@/components/FormButton";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { KeyboardAvoidingView } from "@/components/ui/keyboard-avoiding-view";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import OnboardAvatar from "@/features/user/components/OnboardAvatar";
import OnboardName from "@/features/user/components/OnboardName";
import OnboardPhone from "@/features/user/components/OnboardPhone";
import services from "@/services";
import states from "@/states";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { ImagePickerSuccessResult } from "expo-image-picker";
import { useRouter } from "expo-router";

import { useMemo, useState } from "react";

export default function OnboardingScreen() {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    avatar: null as ImagePickerSuccessResult | null
  });

  const router = useRouter();

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (!values.first_name || !values.last_name || !values.phone) {
        throw new Error("Please fill in all required fields");
      }

      const response = await services.user.saveUser({
        first_name: values.first_name,
        last_name: values.last_name,
        phone: values.phone,
        avatar: values.avatar
      });

      if (!response) {
        throw new Error("Failed to save user details");
      }

      states.user.setState((prev) => ({
        ...prev,
        details: response.data
      }));
      router.replace("/(tabs)");
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const disabledNext =
    useMemo(() => {
      if (step === 1) {
        return !values.first_name || !values.last_name;
      }

      if (step === 2) {
        return !values.phone;
      }

      return false;
    }, [step, values]) || false;

  return (
    <SafeAreaView className="flex-1 bg-background-0">
      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <VStack className="items-center justify-center py-10 px-4">
          <VStack className="w-full gap-y-6">
            <HStack className="items-center justify-between">
              <Text bold className="flex-1 text-3xl">
                Let us onboard you in a few steps
              </Text>
            </HStack>
            <HStack className="gap-x-2">
              <Box
                className={cn(
                  "rounded-lg h-2 flex-1",
                  step >= 1 ? "bg-primary-400" : "bg-secondary-500"
                )}
              />
              <Box
                className={cn(
                  "rounded-lg h-2 flex-1",
                  step >= 2 ? "bg-primary-400" : "bg-secondary-500"
                )}
              />
              <Box
                className={cn(
                  "rounded-lg h-2 flex-1",
                  step >= 3 ? "bg-primary-400" : "bg-secondary-500"
                )}
              />
            </HStack>
          </VStack>
        </VStack>

        {step === 1 && <OnboardName values={values} setValues={setValues} />}
        {step === 2 && <OnboardPhone values={values} setValues={setValues} />}
        {step === 3 && <OnboardAvatar values={values} setValues={setValues} />}

        <Box className="items-center justify-center p-4">
          <HStack className="gap-x-2">
            {step > 1 && (
              <FormButton
                text="Back"
                variant="outline"
                className="flex-1"
                disabled={submitting}
                onPress={() => setStep(step - 1)}
              />
            )}
            {step < 3 && (
              <FormButton
                text="Next"
                className="flex-1"
                disabled={disabledNext}
                onPress={() => setStep(step + 1)}
              />
            )}
            {step === 3 && (
              <FormButton
                text="Finish"
                className="flex-1"
                loading={submitting}
                disabled={disabledNext}
                onPress={handleSubmit}
              />
            )}
          </HStack>
        </Box>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
