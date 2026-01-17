import Logo from '@/components/Logo';
import { Box } from '@/components/ui/box';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { View } from '@/components/ui/view';
import { VStack } from '@/components/ui/vstack';
import { Redirect, useRouter } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { useState } from 'react';
import { ImageBackground } from 'react-native';

export default function Index() {
  const [isAuth, setIsAuth] = useState(false);
  const router = useRouter();

  if (isAuth) {
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
        <VStack className="flex-[3] items-center justify-center">
          <VStack className="gap-y-12">
            <Logo />
            <VStack className="gap-y-1">
              <Text className="text-typography-100 text-center" size="md">
                Clear ang hatian.
              </Text>
              <Text className="text-typography-0 text-center" size="md">
                Clear ang samahan.
              </Text>
            </VStack>
          </VStack>
        </VStack>
        <Box className="flex-1 p-4 gap-y-4 justify-center items-center w-full">
          <Button
            className="bg-primary-400 self-center p-4 w-[64] h-[64] rounded-full shadow-lg"
            onPress={() => router.push('/(auth)/login')}
          >
            <ArrowRight size={64} className="text-typography-0" />
          </Button>
          <Text className="text-typography-100" size="sm">
            Tap the button to get started with Ambagan PH
          </Text>
        </Box>
      </View>
    </ImageBackground>
  );
}
