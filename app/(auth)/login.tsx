import FormButton from "@/components/FormButton";
import FormInput from "@/components/FormInput";
import { HStack } from "@/components/ui/hstack";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import useAppToast from "@/hooks/use-app-toast";
import AuthLayout from "@/layouts/AuthLayout";
import services from "@/services";
import states from "@/states";
import { useRouter } from "expo-router";
import { useState } from "react";

export default function LoginScreen() {
  const [values, setValues] = useState({
    email: "joey@mailinator.com",
    password: "Password1"
  });
  const [formErrors, setFormErrors] = useState({
    email: "",
    password: ""
  }) as any;
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const router = useRouter();
  const toast = useAppToast();

  const handleSubmit = async () => {
    let errors: any = {};

    if (!values.email) {
      errors.email = "Email is required";
    }

    if (!values.password) {
      errors.password = "Password is required";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSubmitting(true);

    try {
      const response = await services.auth.loginWithEmail(
        values.email.trim(),
        values.password.trim()
      );

      if (!response) {
        throw new Error("Login failed");
      }

      states.user.setState((prev) => ({
        ...prev,
        session: response.session
      }));
      router.push("/(tabs)");
    } catch (error) {
      console.log("Error logging in:", error);
      toast({
        title: "Login Failed",
        description: "An error occurred while logging in. Please try again.",
        type: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome Back!"
      subtitle="Login to your account to continue"
      footer={
        <HStack className="gap-x-1">
          <Text className="text-lg text-secondary-950">No account yet?</Text>
          <Link onPress={() => router.push("/sign-up")}>
            <Text className="text-lg font-medium text-primary-400">
              Sign up
            </Text>
          </Link>
        </HStack>
      }
    >
      <VStack className="gap-y-6">
        <FormInput
          type="text"
          label="Email"
          placeholder="Enter your email"
          value={values.email}
          onChangeText={(text) => setValues({ ...values, email: text })}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          errorMessage={formErrors.email}
        />

        <FormInput
          type={showPassword ? "text" : "password"}
          label="Password"
          placeholder="Enter your password"
          value={values.password}
          onChangeText={(text) => setValues({ ...values, password: text })}
          rightIcon={showPassword ? EyeIcon : EyeOffIcon}
          onPressRightIcon={() => setShowPassword(!showPassword)}
          errorMessage={formErrors.password}
        />

        <Link onPress={() => router.push("/forgot-password")}>
          <Text className="text-lg font-medium text-primary-400">
            Forgot Password?
          </Text>
        </Link>

        <FormButton text="Login" loading={submitting} onPress={handleSubmit} />
      </VStack>
    </AuthLayout>
  );
}
