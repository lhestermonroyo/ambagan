import FormButton from "@/components/FormButton";
import Logo from "@/components/Logo";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useRouter } from "expo-router";
import { ImageBackground, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <ImageBackground
      source={require("@/assets/images/splash-bg.jpg")}
      style={styles.bg}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <SafeAreaView className="flex-1 px-4">
        <VStack className="flex-1 justify-end gap-y-6 pb-8">
          <Logo type="splash" />
          <VStack className="gap-y-2">
            <Text bold className="text-background-0 text-3xl">
              Split expenses effortlessly
            </Text>
            <Box className="w-2 h-2 rounded-full bg-primary-400" />
            <Text className="text-background-300 text-lg">
              Track shared costs, settle up with friends, and stay on top of
              every payment — all in one place.
            </Text>
          </VStack>
          <FormButton
            text="Get Started"
            onPress={() => router.push("/(auth)/login")}
          />
        </VStack>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.60)"
  },
  container: {
    flex: 1
  }
});
