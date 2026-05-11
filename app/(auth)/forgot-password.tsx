import FormButton from "@/components/FormButton";
import FormInput from "@/components/FormInput";
import Icon from "@/components/Icon";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import useAppToast from "@/hooks/use-app-toast";
import AuthLayout from "@/layouts/AuthLayout";
import services from "@/services";
import { getPrimaryHex } from "@/utils/getColorHex";
import { useRouter } from "expo-router";
import { MailCheck } from "lucide-react-native";
import { useState } from "react";
import { useColorScheme } from "react-native";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const router = useRouter();
  const toast = useAppToast();
  const colorScheme = useColorScheme() ?? "light";
  const iconColor = colorScheme === "dark" ? "#8B5CF6" : "#7C3AED";

  const handleSend = async () => {
    if (!email.trim()) {
      setEmailError("Email is required");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email.trim())) {
      setEmailError("Enter a valid email address");
      return;
    }

    setEmailError("");
    setSubmitting(true);

    try {
      await services.auth.resetPassword(email.trim());
      setSent(true);
    } catch {
      toast({
        title: "Request Failed",
        description: "Could not send reset email. Please try again.",
        type: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle={`We sent a password reset link to ${email.trim()}`}
        footer={
          <FormButton
            icon={<Icon as="chevron-left" className="text-primary-400" />}
            variant="outline"
            text="Back to Login"
            onPress={() => router.replace("/(auth)/login")}
          />
        }
      >
        <VStack className="gap-y-6 items-center py-4">
          <Box className="bg-primary-100 rounded-full p-6">
            <MailCheck
              size={36}
              color={getPrimaryHex("text-primary-500", colorScheme)}
            />
          </Box>
          <VStack className="gap-y-2 items-center">
            <Text className="text-secondary-950 text-center">
              Open the link in the email to set a new password. If you don't see
              it, check your spam folder.
            </Text>
          </VStack>
          <FormButton
            text="Resend Email"
            loading={submitting}
            onPress={handleSend}
          />
        </VStack>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Forgot Password"
      subtitle="Enter your email and we'll send you a reset link"
      footer={
        <FormButton
          icon={
            <Icon as="chevron-left" className="text-primary-400 -ml-2 -mr-1" />
          }
          variant="outline"
          text="Back to Login"
          onPress={() => router.back()}
        />
      }
    >
      <VStack className="gap-y-6">
        <FormInput
          type="text"
          label="Email"
          placeholder="Enter your email"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (emailError) setEmailError("");
          }}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          errorMessage={emailError}
        />
        <FormButton
          text="Send Reset Link"
          loading={submitting}
          onPress={handleSend}
        />
      </VStack>
    </AuthLayout>
  );
}
