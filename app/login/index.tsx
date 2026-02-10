import FormButton from '@/components/FormButton';
import FormInput from '@/components/FormInput';
import Logo from '@/components/Logo';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Center } from '@/components/ui/center';
import { Divider } from '@/components/ui/divider';
import { HStack } from '@/components/ui/hstack';
import { EyeIcon, EyeOffIcon } from '@/components/ui/icon';
import { Image } from '@/components/ui/image';
import { KeyboardAvoidingView } from '@/components/ui/keyboard-avoiding-view';
import { Link } from '@/components/ui/link';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { ScrollView } from '@/components/ui/scroll-view';
import { Text } from '@/components/ui/text';
import {
  Toast,
  ToastDescription,
  ToastTitle,
  useToast
} from '@/components/ui/toast';
import { VStack } from '@/components/ui/vstack';
import services from '@/services';
import states from '@/states';
import { useRouter } from 'expo-router';
import { useState } from 'react';

export default function LoginScreen() {
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

  const handleSubmit = async () => {
    try {
      setSubmitting(true);

      let errors: any = {};

      if (!values.email) {
        errors.email = 'Email is required';
      }

      if (!values.password) {
        errors.password = 'Password is required';
      }

      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }

      const response = await services.auth.loginWithEmail(
        values.email.trim(),
        values.password.trim()
      );

      if (response && response.session) {
        states.auth.setState((prev) => ({
          ...prev,
          session: response.session
        }));
      }
    } catch (error) {
      console.log('Error creating account:', error);
      handleToast(
        'Login Failed',
        'An error occurred while creating your account. Please try again.',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoginWithGoogle = async () => {
    try {
      setSubmitting(true);

      const response = await services.auth.loginWithGoogle();

      console.log('response', response);
    } catch (error) {
      console.log('Error logging in with Google:', error);
      handleToast(
        'Login Failed',
        'An error occurred while logging in with Google. Please try again.',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView className="bg-white flex-1" behavior="padding">
      <ScrollView>
        <SafeAreaView>
          <VStack className="my-12 px-4 gap-y-10">
            <Logo type="auth" />

            <VStack>
              <Text size="4xl" bold className="text-center">
                Hello there!
              </Text>
              <Text className="text-center text-xl text-secondary-950">
                Login to your account
              </Text>
            </VStack>

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

              <Link onPress={() => router.push('/forgot-password')}>
                <Text className="text-primary-400 text-center">
                  Forgot Password?
                </Text>
              </Link>

              <VStack className="gap-y-8">
                <FormButton
                  text="Login"
                  loading={submitting}
                  onPress={handleSubmit}
                />
                <Box className="items-center justify-center">
                  <Divider />
                  <Text className="top-[-12] absolute bg-white text-center text-secondary-950 px-4 z-10">
                    Or continue with
                  </Text>
                </Box>
                <Button
                  className="rounded-full border-secondary-800 bg-white border"
                  size="xl"
                  variant="outline"
                  action="default"
                  onPress={handleLoginWithGoogle}
                >
                  <Image
                    source={require('@/assets/images/google-logo.png')}
                    className="h-[24] w-[24]"
                    resizeMode="cover"
                    alt="google-logo"
                  />
                  <ButtonText className="text-inherit">
                    Login with Google
                  </ButtonText>
                </Button>
              </VStack>
            </VStack>

            <Center>
              <HStack className="gap-x-1">
                <Text className="text-secondary-950">No account yet?</Text>
                <Link onPress={() => router.push('/sign-up')}>
                  <Text className="text-primary-400">Sign up</Text>
                </Link>
              </HStack>
            </Center>
          </VStack>
        </SafeAreaView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
