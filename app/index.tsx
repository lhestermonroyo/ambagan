import FormButton from '@/components/FormButton';
import Icon from '@/components/Icon';
import Logo from '@/components/Logo';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { View } from '@/components/ui/view';
import { VStack } from '@/components/ui/vstack';
import services from '@/services';
import states from '@/states';
import { supabase } from '@/utils/supabase';
import { Redirect, useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useEffect } from 'react';
import { ImageBackground } from 'react-native';

export default function Index() {
  const auth = states.auth((state) => state);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      states.auth.setState((prev) => ({
        ...prev,
        session
      }));
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      states.auth.setState((prev) => ({
        ...prev,
        session
      }));
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (auth.session) {
      fetchUser(auth.session.user.id);
    }
  }, [auth.session]);

  const fetchUser = async (id: string) => {
    try {
      const response = await services.user.getUserById(id);
      console.log('response', response);

      if (response && response.data) {
        states.auth.setState((prev) => ({
          ...prev,
          user: response.data
        }));
      }
    } catch (error) {
      console.log('Error fetching user:', error);
      states.auth.setState((prev) => ({
        ...prev,
        session: null,
        user: null
      }));
    }
  };

  if (auth.session) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <ImageBackground
      source={require('@/assets/images/splash-bg.jpg')}
      className="flex-1"
      resizeMode="cover"
      imageStyle={{
        alignSelf: 'flex-end',
        height: '100%',
        width: '100%',
        resizeMode: 'cover',
        position: 'absolute',
        bottom: 0
      }}
    >
      <View className="absolute inset-0 bg-neutral-900 opacity-60" />
      <View className="flex-1">
        <VStack className="flex-[4] items-center justify-center">
          <VStack space="2xl" className="gap-y-12">
            <Logo />
            <VStack className="gap-y-1">
              <Text className="text-typography-100 text-center" size="lg">
                Clear ang hatian.
              </Text>
              <Text className="text-typography-0 text-center" size="lg">
                Clear ang samahan.
              </Text>
            </VStack>
          </VStack>
        </VStack>
        <Box className="flex-1 p-4 gap-y-4 justify-center w-full">
          <FormButton
            iconEnd={<Icon name={ChevronRight} />}
            onPress={() => router.push('/(auth)/login')}
            text="Get Started"
          />
        </Box>
      </View>
    </ImageBackground>
  );
}
