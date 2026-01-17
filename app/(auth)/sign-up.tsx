import FormButton from '@/components/FormButton';
import FormInput from '@/components/FormInput';
import Logo from '@/components/Logo';
import { Center } from '@/components/ui/center';
import { HStack } from '@/components/ui/hstack';
import { EyeIcon, EyeOffIcon } from '@/components/ui/icon';
import { Link } from '@/components/ui/link';
import { Text } from '@/components/ui/text';
import {
  Toast,
  ToastDescription,
  ToastTitle,
  useToast
} from '@/components/ui/toast';
import { VStack } from '@/components/ui/vstack';
import states from '@/states';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, SafeAreaView, ScrollView } from 'react-native';

export default function SignUpScreen() {
  const auth = states.auth((state) => state);

  const [values, setValues] = useState({
    firstname: '',
    lastname: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [formErrors, setFormErrors] = useState({
    firstname: '',
    lastname: '',
    email: '',
    password: '',
    confirmPassword: ''
  }) as any;
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const router = useRouter();
  const toast = useToast();

  const handleToast = (title: string, description: string, type: any) => {
    toast.show({
      placement: 'top',
      duration: 5000,
      render: ({ id }) => {
        const uniqueToastId = 'toast-' + id;

        return (
          <Toast nativeID={uniqueToastId} action={type} variant="outline">
            <ToastTitle>{title}</ToastTitle>
            <ToastDescription>{description}</ToastDescription>
          </Toast>
        );
      }
    });
  };

  // const handleSubmit = async () => {
  //   try {
  //     setSubmitting(true);

  //     let errors: any = {};

  //     if (!values.email) {
  //       errors.email = 'Email is required';
  //     }

  //     if (!values.password) {
  //       errors.password = 'Password is required';
  //     }

  //     if (Object.keys(errors).length > 0) {
  //       setFormErrors(errors);
  //       return;
  //     }

  //     const user: any = await services.auth.logIn(
  //       values.email.trim(),
  //       values.password.trim()
  //     );

  //     if (user) {
  //       if (user.emailVerified) {
  //         const userDetails = await services.database.getUser(user.email);

  //         setAuth({
  //           user: {
  //             ...userDetails
  //           },
  //           isAuth: true
  //         });
  //         setValues({
  //           email: '',
  //           password: ''
  //         });

  //         router.push('/(tabs)/MyTrips');
  //       } else {
  //         handleToast(
  //           'Account Not Verified',
  //           'Please verify your email first to login.',
  //           'warning'
  //         );
  //       }
  //     }
  //   } catch (error) {
  //     console.log('Error creating account:', error);
  //     handleToast(
  //       'Login Failed',
  //       'An error occurred while creating your account. Please try again.',
  //       'error'
  //     );
  //   } finally {
  //     setSubmitting(false);
  //   }
  // };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView className="bg-primary-0">
          <VStack className="my-20 px-4 space-y-8">
            <Logo type="auth" />

            <VStack className="space-y-2">
              <Text size="4xl" bold className="text-inherit text-center">
                Welcome back!
              </Text>
              <Text size="md" className="text-typography-500 text-center">
                Login to your account
              </Text>
            </VStack>

            <VStack className="space-y-4">
              <FormInput
                type="text"
                label="Firstname"
                placeholder="Enter your firstname"
                value={values.firstname}
                onChangeText={(text) =>
                  setValues({ ...values, firstname: text })
                }
                autoCapitalize="none"
                errorMessage={formErrors.firstname}
              />

              <FormInput
                type="text"
                label="Lastname"
                placeholder="Enter your lastname"
                value={values.lastname}
                onChangeText={(text) =>
                  setValues({ ...values, lastname: text })
                }
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
                type={showPassword ? 'text' : 'password'}
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

              <FormInput
                type={showPassword ? 'text' : 'password'}
                label="Password"
                placeholder="Enter your password"
                value={values.password}
                onChangeText={(text) =>
                  setValues({ ...values, password: text })
                }
                rightIcon={showPassword ? EyeIcon : EyeOffIcon}
                onPressRightIcon={() => setShowPassword(!showPassword)}
                errorMessage={formErrors.password}
              />

              <FormButton
                text="Sign Up"
                loading={submitting}
                // onPress={handleSubmit}
              />
            </VStack>

            <Center>
              <HStack className="space-x-1">
                <Text size="md" className="text-gray-400">
                  Already have an account?
                </Text>
                <Link onPress={() => router.push('/(auth)/login')}>
                  <Text size="md" className="text-primary-500">
                    Login
                  </Text>
                </Link>
              </HStack>
            </Center>
          </VStack>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
