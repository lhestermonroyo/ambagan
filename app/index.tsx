import FormButton from '@/components/FormButton';
import Icon from '@/components/Icon';
import Logo from '@/components/Logo';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { View } from '@/components/ui/view';
import { VStack } from '@/components/ui/vstack';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { ImageBackground } from 'react-native';

export default function Index() {
  const router = useRouter();

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
            iconEnd={<Icon as={ChevronRight} />}
            onPress={() => router.push('/login')}
            text="Get Started"
          />
        </Box>
      </View>
    </ImageBackground>
  );
}
