import FormButton from "@/components/FormButton";
import { Box } from "@/components/ui/box";
import { Button, ButtonIcon } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { KeyboardAvoidingView } from "@/components/ui/keyboard-avoiding-view";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import OnboardAvatar from "@/features/user/components/OnboardAvatar";
import OnboardName from "@/features/user/components/OnboardName";
import OnboardPhone from "@/features/user/components/OnboardPhone";
import useAppToast from "@/hooks/use-app-toast";
import { useActionFeedback } from "@/hooks/useActionFeedback";
import services from "@/services";
import states from "@/states";
import {
  clearPendingInviteToken,
  getPendingInviteToken
} from "@/utils/pendingInvite";
import { normalizePhone } from "@/utils/phone";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { ImagePickerSuccessResult } from "expo-image-picker";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";

import { useHideSplashOnFirstFrame } from "@/hooks/useHideSplash";
import { useEffect, useMemo, useState } from "react";

const ONBOARDING_STEPS = [
  {
    title: "What's Your Name?",
    subtitle: "Let's start with your name. You can change this later."
  },
  {
    title: "What's Your Phone Number?",
    subtitle: "Used for account recovery and important notifications."
  },
  {
    title: "Add a Profile Photo",
    subtitle:
      "Help your friends recognize you. This is optional, and you can add one later."
  }
];

export default function OnboardingScreen() {
  // Cold-launch landing screen: holds the native splash until this screen's
  // first frame is drawn, so the launch never flashes the bare window.
  useHideSplashOnFirstFrame();
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
  const toast = useAppToast();
  const showFeedback = useActionFeedback();

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
        details: response.data,
        routeIntent: "tabs"
      }));

      // Consume any pending invite that was stashed before the user had an account.
      try {
        const pendingToken = await getPendingInviteToken();
        if (pendingToken) {
          const groupId = await services.group.joinGroupByToken(pendingToken);
          await clearPendingInviteToken();
          await showFeedback("onboarding-joined", { afterNavigation: true });
          router.replace(`/groups/${groupId}` as any);
          return;
        }
      } catch {
        await clearPendingInviteToken();
      }

      await showFeedback("onboarding-completed", { afterNavigation: true });
      router.replace("/(tabs)/(home)");
    } catch (error: any) {
      console.error(error);

      // Duplicate email: a password (or other) account already owns this email,
      // but Supabase issued a SEPARATE auth user (identities weren't linked), so
      // saveUser's INSERT hit the users_tbl email UNIQUE constraint (Postgres
      // 23505). Don't strand the user in a half-created state — sign this orphan
      // session out and send them back to log in with their existing account.
      const isDuplicateEmail =
        error?.code === "23505" ||
        /duplicate key|users_tbl_email/i.test(error?.message ?? "");

      if (isDuplicateEmail) {
        toast({
          title: "Email Already in Use",
          description:
            "An account with this email already exists. Please log in with your password instead.",
          type: "error"
        });
        try {
          await services.auth.logout();
        } catch {
          // best-effort — still reset local state and route to login below
        }
        states.user.getState().signOut();
        router.replace("/(auth)/login");
        return;
      }

      toast({
        title: "Onboarding Failed",
        description:
          error?.message === "Please fill in all required fields"
            ? "Please fill in all required fields."
            : "We couldn't save your details. Please try again.",
        type: "error"
      });
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

  const currentStep = ONBOARDING_STEPS[step - 1];

  return (
    <SafeAreaView className="flex-1 bg-background-0">
      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <VStack className="px-4 pt-6 pb-4 gap-y-6">
          <Text className="self-end text-secondary-950">Step {step} of 3</Text>
          <HStack
            className="gap-x-2"
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Onboarding progress"
            accessibilityValue={{ min: 1, max: 3, now: step }}
          >
            {ONBOARDING_STEPS.map((_, index) => (
              <Box
                key={index}
                className={cn(
                  "rounded-lg h-2 flex-1",
                  step > index ? "bg-primary-400" : "bg-secondary-500"
                )}
              />
            ))}
          </HStack>
        </VStack>

        <ScrollView
          className="flex-1"
          bounces={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <VStack className="px-4 pt-6 pb-8 gap-y-8">
            <VStack className="gap-y-3">
              <Text size="3xl" bold accessibilityRole="header">
                {currentStep.title}
              </Text>
              <Text className="text-xl text-secondary-950">
                {currentStep.subtitle}
              </Text>
            </VStack>

            {step === 1 && (
              <OnboardName values={values} setValues={setValues} />
            )}
            {step === 2 && (
              <OnboardPhone values={values} setValues={setValues} />
            )}
            {step === 3 && (
              <OnboardAvatar values={values} setValues={setValues} />
            )}
          </VStack>
        </ScrollView>

        <Box className="p-4">
          <HStack className="gap-x-2 items-center">
            {step > 1 && (
              <Button
                accessibilityLabel="Back"
                variant="outline"
                className="h-12 w-14 shrink-0 rounded-full p-0"
                disabled={submitting}
                onPress={() => setStep(step - 1)}
              >
                <ButtonIcon as={ChevronLeft} className="h-8 w-8" />
              </Button>
            )}
            {step < 3 && (
              <FormButton
                text="Continue"
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
