import FormButton from "@/components/FormButton";
import FormInput from "@/components/FormInput";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icon";
import { VStack } from "@/components/ui/vstack";
import useAppToast from "@/hooks/use-app-toast";
import AuthLayout from "@/layouts/AuthLayout";
import services from "@/services";
import { useRouter } from "expo-router";
import { useState } from "react";

export default function ResetPasswordScreen() {
  const [values, setValues] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState({ password: "", confirm: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const router = useRouter();
  const toast = useAppToast();

  const handleSubmit = async () => {
    const next: typeof errors = { password: "", confirm: "" };

    if (!values.password) {
      next.password = "Password is required";
    } else if (values.password.length < 8) {
      next.password = "Password must be at least 8 characters";
    }

    if (!values.confirm) {
      next.confirm = "Please confirm your password";
    } else if (values.password !== values.confirm) {
      next.confirm = "Passwords do not match";
    }

    if (next.password || next.confirm) {
      setErrors(next);
      return;
    }

    setSubmitting(true);
    try {
      await services.auth.setNewPassword(values.password);
      toast({
        title: "Password Updated",
        description: "Your password has been changed. Please log in.",
        type: "success"
      });
      router.replace("/(auth)/login");
    } catch {
      toast({
        title: "Update Failed",
        description: "Could not update your password. Please try again.",
        type: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Set New Password"
      subtitle="Choose a strong password for your account"
    >
      <VStack className="gap-y-6">
        <FormInput
          type={showPassword ? "text" : "password"}
          label="New Password"
          placeholder="At least 8 characters"
          value={values.password}
          onChangeText={(text) => {
            setValues((v) => ({ ...v, password: text }));
            if (errors.password) setErrors((e) => ({ ...e, password: "" }));
          }}
          rightIcon={showPassword ? EyeIcon : EyeOffIcon}
          onPressRightIcon={() => setShowPassword((v) => !v)}
          errorMessage={errors.password}
        />
        <FormInput
          type={showConfirm ? "text" : "password"}
          label="Confirm Password"
          placeholder="Re-enter your password"
          value={values.confirm}
          onChangeText={(text) => {
            setValues((v) => ({ ...v, confirm: text }));
            if (errors.confirm) setErrors((e) => ({ ...e, confirm: "" }));
          }}
          rightIcon={showConfirm ? EyeIcon : EyeOffIcon}
          onPressRightIcon={() => setShowConfirm((v) => !v)}
          errorMessage={errors.confirm}
        />
        <FormButton
          text="Update Password"
          loading={submitting}
          onPress={handleSubmit}
        />
      </VStack>
    </AuthLayout>
  );
}
