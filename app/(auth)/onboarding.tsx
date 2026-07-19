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
import { normalizePhone } from "@/utils/phone";
import {
  clearPendingInviteToken,
  getPendingInviteToken
} from "@/utils/pendingInvite";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { ImagePickerSuccessResult } from "expo-image-picker";
import { useRouter } from "expo-router";

import { useEffect, useMemo, useState } from "react";

export default function OnboardingScreen() {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  // Seed the name from a Google/Apple sign-in (if any) so the user doesn't
  // retype it. Read lazily from the store — Apple only ever returns it once.
  const [values, setValues] = useState(() => {
    const oauthName = states.user.getState().oauthName;
    return {
      first_name: oauthName?.firstName ?? "",
      last_name: oauthName?.lastName ?? "",
      phone: "",
      avatar: null as ImagePickerSuccessResult | null
    };
  });

  const router = useRouter();

  // The stashed OAuth name was consumed into the initial form state above;
  // clear it from the store so it can't leak into a later onboarding session.
  useEffect(() => {
    if (states.user.getState().oauthName) {
      states.user.setState((prev) => ({ ...prev, oauthName: null }));
    }
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (!values.first_name || !values.last_name || !values.phone) {
        throw new Error("Please fill in all required fields");
      }

      // Store the phone in E.164 so it matches phone-contact placeholders.
      const normalizedPhone = normalizePhone(values.phone) ?? values.phone;

      const response = await services.user.saveUser({
        first_name: values.first_name,
        last_name: values.last_name,
        phone: normalizedPhone,
        avatar: values.avatar
      });

      if (!response) {
        throw new Error("Failed to save user details");
      }

      // If someone already added this person as a phone contact, claim that
      // placeholder now — its groups and balances move onto this account.
      try {
        await services.user.claimPlaceholder(normalizedPhone);
      } catch (claimError) {
        console.error("Failed to claim placeholder:", claimError);
      }

      states.user.setState((prev) => ({
        ...prev,
        details: response.data
      }));

      // Consume any pending invite that was stashed before the user had an account.
      try {
        const pendingToken = await getPendingInviteToken();
        if (pendingToken) {
          const groupId = await services.group.joinGroupByToken(pendingToken);
          await clearPendingInviteToken();
          router.replace(`/groups/${groupId}` as any);
          return;
        }
      } catch {
        await clearPendingInviteToken();
      }

      router.replace("/(tabs)/(home)");
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
