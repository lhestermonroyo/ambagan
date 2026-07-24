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

export default function SignUpScreen() {
  const [values, setValues] = useState({
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [formErrors, setFormErrors] = useState({
    email: "",
    password: "",
    confirmPassword: ""
  }) as any;
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const router = useRouter();
  const toast = useAppToast();

  const handleSubmit = async () => {
    let errors: any = {};

    const email = values.email.trim();

    if (!email) {
      errors.email = "Email is required";
    } else if (!services.auth.isValidEmail(email)) {
      errors.email = "Enter a valid email address";
    }

    if (!values.password) {
      errors.password = "Password is required";
    } else if (values.password.length < services.auth.MIN_PASSWORD_LENGTH) {
      errors.password = `Password must be at least ${services.auth.MIN_PASSWORD_LENGTH} characters`;
    }

    if (!values.confirmPassword) {
      errors.confirmPassword = "Please confirm your password";
    } else if (values.confirmPassword !== values.password) {
      errors.confirmPassword = "Passwords do not match";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSubmitting(true);
    setFormErrors({ email: "", password: "", confirmPassword: "" });

    try {
      const response = await services.auth.signUp({
        email: values.email.trim(),
        password: values.password.trim()
      });

      // Email already has an account (e.g. a Google-first user). When email
      // confirmations are ON, Supabase obfuscates this as a user with an empty
      // identities array and no session — treat that as "already registered".
      const alreadyRegistered =
        !!response.user && (response.user.identities?.length ?? 0) === 0;

      if (alreadyRegistered) {
        toast({
          title: "Email already in use",
          description:
            "This email already has an account. Please log in instead.",
          type: "error"
        });
        router.replace("/(auth)/login");
        return;
      }

      if (!response.session || !response.user) {
        throw new Error("Sign up failed");
      }

      states.user.setState((prev) => ({
        ...prev,
        session: response.session
      }));
      router.push("/onboarding");
    } catch (error: any) {
      // With confirmations OFF, a duplicate email throws instead of obfuscating.
      const alreadyRegistered =
        error?.code === "user_already_exists" ||
        /already registered|already been registered|user_already_exists/i.test(
          error?.message ?? ""
        );

      if (alreadyRegistered) {
        toast({
          title: "Email already in use",
          description:
            "This email already has an account. Please log in instead.",
          type: "error"
        });
        router.replace("/(auth)/login");
        return;
      }

      console.log("Error creating account:", error);
      toast({
        title: "Sign Up Failed",
        description:
          "An error occurred while creating your account. Please try again.",
        type: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create Account"
      subtitle="Sign up to get started"
      footer={
        <HStack className="gap-x-1">
          <Text className="text-lg text-secondary-950">
            Already have an account?
          </Text>
          <Link onPress={() => router.back()}>
            <Text className="text-lg font-medium text-primary-400">Login</Text>
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

        <FormInput
          type={showConfirmPassword ? "text" : "password"}
          label="Confirm Password"
          placeholder="Confirm your password"
          value={values.confirmPassword}
          onChangeText={(text) =>
            setValues({ ...values, confirmPassword: text })
          }
          rightIcon={showConfirmPassword ? EyeIcon : EyeOffIcon}
          onPressRightIcon={() => setShowConfirmPassword(!showConfirmPassword)}
          errorMessage={formErrors.confirmPassword}
        />

        <FormButton
          className="mt-4"
          text="Sign Up"
          loading={submitting}
          onPress={handleSubmit}
        />
      </VStack>
    </AuthLayout>
  );
}
