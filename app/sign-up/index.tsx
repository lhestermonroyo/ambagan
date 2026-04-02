import FormButton from "@/components/FormButton";
import FormInput from "@/components/FormInput";
import { Center } from "@/components/ui/center";
import { HStack } from "@/components/ui/hstack";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import {
  Toast,
  ToastDescription,
  ToastTitle,
  useToast
} from "@/components/ui/toast";
import { VStack } from "@/components/ui/vstack";
import AuthLayout from "@/layouts/AuthLayout";
import services from "@/services";
import states from "@/states";
import { useRouter } from "expo-router";
import { useState } from "react";

export default function SignUpScreen() {
  const [values, setValues] = useState({
    firstname: "",
    lastname: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [formErrors, setFormErrors] = useState({
    firstname: "",
    lastname: "",
    email: "",
    password: "",
    confirmPassword: ""
  }) as any;
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const router = useRouter();
  const toast = useToast();

  const handleToast = (title: string, description: string, type: any) => {
    toast.show({
      placement: "top",
      duration: 5000,
      render: ({ id }) => {
        const uniqueToastId = "toast-" + id;

        return (
          <Toast nativeID={uniqueToastId} action={type} variant="outline">
            <ToastTitle>{title}</ToastTitle>
            <ToastDescription>{description}</ToastDescription>
          </Toast>
        );
      }
    });
  };

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
      const response = await services.auth.signUp({
        email: values.email.trim(),
        password: values.password.trim(),
        first_name: values.firstname.trim(),
        last_name: values.lastname.trim()
      });

      if (!response.session || !response.user) {
        throw new Error("Sign up failed");
      }

      const user = await services.user.saveUser({
        id: response.user.id,
        email: values.email.trim(),
        first_name: values.firstname.trim(),
        last_name: values.lastname.trim()
      });

      if (!user) {
        throw new Error("Failed to save user details");
      }

      states.user.setState((prev) => ({
        ...prev,
        session: response.session
      }));
    } catch (error) {
      console.log("Error creating account:", error);
      handleToast(
        "Sign Up Failed",
        "An error occurred while creating your account. Please try again.",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Create Account" subtitle="Sign up to get started">
      <VStack className="gap-y-6">
        <FormInput
          type="text"
          label="Firstname"
          placeholder="Enter your firstname"
          value={values.firstname}
          onChangeText={(text) => setValues({ ...values, firstname: text })}
          autoCapitalize="none"
          errorMessage={formErrors.firstname}
        />

        <FormInput
          type="text"
          label="Lastname"
          placeholder="Enter your lastname"
          value={values.lastname}
          onChangeText={(text) => setValues({ ...values, lastname: text })}
          autoCapitalize="none"
          errorMessage={formErrors.lastname}
        />

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
          type={showPassword ? "text" : "password"}
          label="Confirm Password"
          placeholder="Enter your confirm password"
          value={values.confirmPassword}
          onChangeText={(text) =>
            setValues({ ...values, confirmPassword: text })
          }
          rightIcon={showPassword ? EyeIcon : EyeOffIcon}
          onPressRightIcon={() => setShowPassword(!showPassword)}
          errorMessage={formErrors.confirmPassword}
        />

        <FormButton
          text="Sign Up"
          loading={submitting}
          onPress={handleSubmit}
        />
      </VStack>

      <Center>
        <HStack className="gap-x-1">
          <Text className="text-secondary-950">Already have an account?</Text>
          <Link onPress={() => router.push("/login")}>
            <Text className="text-primary-400">Login</Text>
          </Link>
        </HStack>
      </Center>
    </AuthLayout>
  );
}
