import FormButton from '@/components/FormButton';
import FormInput from '@/components/FormInput';
import Logo from '@/components/Logo';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Center } from '@/components/ui/center';
import { Divider } from '@/components/ui/divider';
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
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, SafeAreaView, ScrollView } from 'react-native';

export default function LoginScreen() {
  const auth = states.auth((state) => state);

  const [values, setValues] = useState({
    email: '',
    password: ''
  });
  const [formErrors, setFormErrors] = useState({
    email: '',
    password: ''
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

              <Link onPress={() => router.push('/(auth)/forgot-password')}>
                <Text size="md" className="text-primary-500 text-center">
                  Forgot Password?
                </Text>
              </Link>

              <VStack className="space-y-8">
                <FormButton
                  text="Login"
                  loading={submitting}
                  // onPress={handleSubmit}
                />
                <Box className="items-center justify-center">
                  <Divider />
                  <Text
                    size="md"
                    className="top-[-12] absolute bg-primary-0 text-center px-4 z-10"
                  >
                    Or continue with
                  </Text>
                </Box>
                <Button
                  className="rounded-full border-gray-300 bg-white border"
                  size="xl"
                  variant="outline"
                  action="default"
                >
                  <Image
                    source={require('@/assets/images/google-logo.png')}
                    className="h-[24] w-[24]"
                  />
                  <ButtonText className="text-inherit">
                    Login with Google
                  </ButtonText>

                  {/* {loading && <ButtonSpinner className="text-white" />} */}
                </Button>
              </VStack>
            </VStack>

            <Center>
              <HStack className="space-x-1">
                <Text size="md" className="text-gray-400">
                  No account yet?
                </Text>
                <Link onPress={() => router.push('/(auth)/sign-up')}>
                  <Text size="md" className="text-primary-500">
                    Sign up
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
