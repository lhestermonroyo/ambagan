import FormButton from "@/components/FormButton";
import Logo from "@/components/Logo";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { useRouter } from "expo-router";
import { ImageBackground } from "react-native";
import Icon from "./Icon";

export default function SplashScreen() {
  const router = useRouter();

  return (
    <ImageBackground
      source={require("@/assets/images/splash-bg.jpg")}
      className="flex-1"
      resizeMode="cover"
      imageStyle={{
        alignSelf: "flex-end",
        height: "100%",
        width: "100%",
        resizeMode: "cover",
        position: "absolute",
        bottom: 0
      }}
    >
      <View className="absolute inset-0 bg-neutral-900 opacity-60" />
      <View className="flex-1">
        <VStack className="flex-[4] items-center justify-center">
          <VStack space="2xl" className="gap-y-12">
            <Logo />
            <VStack className="gap-y-1">
              <Text className="text-gray-50 text-center" size="lg">
                Clear ang hatian.
              </Text>
              <Text className="text-gray-300 text-center" size="lg">
                Clear ang samahan.
              </Text>
            </VStack>
          </VStack>
        </VStack>
        <Box className="flex-1 p-4 gap-y-4 justify-center w-full">
          <FormButton
            onPress={() => router.push("/login")}
            iconEnd={<Icon as="chevron-right" className="text-background-0" />}
            text="Get Started"
          />
        </Box>
      </View>
    </ImageBackground>
  );
}
