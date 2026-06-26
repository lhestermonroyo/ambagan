import ConfirmButton from "@/components/ConfirmButton";
import FormButton from "@/components/FormButton";
import FormInput from "@/components/FormInput";
import { Divider } from "@/components/ui/divider";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import useAppToast from "@/hooks/use-app-toast";
import InnerLayout from "@/layouts/InnerLayout";
import services from "@/services";
import states from "@/states";
import { useRouter } from "expo-router";
import { Eye, EyeOff } from "lucide-react-native";
import { useState } from "react";

export default function AccountSettingsScreen() {
  const router = useRouter();
  const toast = useAppToast();
  const { signOut } = states.user();

  const [submitting, setSubmitting] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [values, setValues] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [errors, setErrors] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const validate = () => {
    const newErrors = {
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    };
    let valid = true;

    if (!values.currentPassword) {
      newErrors.currentPassword = "Current password is required.";
      valid = false;
    }

    if (!values.newPassword) {
      newErrors.newPassword = "New password is required.";
      valid = false;
    } else if (values.newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters.";
      valid = false;
    }

    if (!values.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your new password.";
      valid = false;
    } else if (values.newPassword !== values.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
      valid = false;
    }

    setErrors(newErrors);
    return valid;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      await services.user.updatePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword
      });

      setValues({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast({
        title: "Password Updated",
        description: "Your password has been changed successfully.",
        type: "success"
      });
      router.back();
    } catch (error: any) {
      const message =
        error?.message === "Current password is incorrect"
          ? "Current password is incorrect."
          : "Failed to update password. Please try again.";

      toast({
        title: "Error",
        description: message,
        type: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await services.auth.deleteAccount();
      signOut();
      router.replace("/(auth)/login");
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete account. Please try again.",
        type: "error"
      });
    }
  };

  return (
    <InnerLayout title="Account Settings" onBack={() => router.back()}>
      <ScrollView className="flex-1">
        <VStack className="gap-y-6 p-4">
          <VStack className="gap-y-4">
            <FormInput
              label="Current Password"
              placeholder="Enter current password"
              type={showCurrentPassword ? "text" : "password"}
              value={values.currentPassword}
              onChangeText={(text) =>
                setValues({ ...values, currentPassword: text })
              }
              errorMessage={errors.currentPassword}
              rightIcon={showCurrentPassword ? EyeOff : Eye}
              onPressRightIcon={() =>
                setShowCurrentPassword(!showCurrentPassword)
              }
            />

            <FormInput
              label="New Password"
              placeholder="Enter new password"
              type={showNewPassword ? "text" : "password"}
              value={values.newPassword}
              onChangeText={(text) =>
                setValues({ ...values, newPassword: text })
              }
              errorMessage={errors.newPassword}
              rightIcon={showNewPassword ? EyeOff : Eye}
              onPressRightIcon={() => setShowNewPassword(!showNewPassword)}
            />

            <FormInput
              label="Confirm New Password"
              placeholder="Re-enter new password"
              type={showConfirmPassword ? "text" : "password"}
              value={values.confirmPassword}
              onChangeText={(text) =>
                setValues({ ...values, confirmPassword: text })
              }
              errorMessage={errors.confirmPassword}
              rightIcon={showConfirmPassword ? EyeOff : Eye}
              onPressRightIcon={() =>
                setShowConfirmPassword(!showConfirmPassword)
              }
            />
          </VStack>
          <FormButton
            text="Update Password"
            loading={submitting}
            onPress={handleSubmit}
          />

          <Divider className="border-background-200" />

          <VStack className="gap-y-4">
            <VStack className="gap-y-2">
              <Text bold className="text-xl">
                Delete Account
              </Text>
              <Text className="text-sm text-secondary-950">
                Permanently delete your account and all associated data. This
                action cannot be undone.
              </Text>
            </VStack>
            <ConfirmButton
              text="Delete My Account"
              action="negative"
              isDelete
              confirmTitle="Delete Account"
              confirmDescription="Are you sure you want to delete your account? All your data — groups, expenses, and settlements — will be permanently removed. This cannot be undone."
              onConfirm={handleDeleteAccount}
            />
          </VStack>
        </VStack>
      </ScrollView>
    </InnerLayout>
  );
}
