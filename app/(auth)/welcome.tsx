import FormButton from "@/components/FormButton";
import Logo from "@/components/Logo";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { getSecondaryHex } from "@/utils/getColorHex";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { Copyright } from "lucide-react-native";
import {
  ImageBackground,
  StyleSheet,
  useColorScheme,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function WelcomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";

  return (
    <ImageBackground
      source={require("@/assets/images/splash-bg.jpg")}
      style={styles.bg}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <SafeAreaView className="flex-1 px-4">
        <VStack className="flex-1 justify-end gap-y-6">
          <Logo type="splash" />
          <VStack className="gap-y-2">
            <Text bold className="text-background-0 text-3xl">
              Split expenses effortlessly
            </Text>
            <Box className="w-2 h-2 rounded-full bg-primary-400" />
            <Text className="text-background-300 text-lg">
              Log a shared expense in seconds, see exactly who owes who, and
              settle up with proof — fair and square.
            </Text>
          </VStack>
          <VStack className="gap-y-4">
            <FormButton
              text="Get Started"
              onPress={() => router.push("/(auth)/login")}
            />
            <HStack className="items-center justify-center gap-x-1">
              <Copyright
                size={12}
                color={getSecondaryHex("text-secondary-950", colorScheme)}
              />
              <Text className="text-center text-sm text-secondary-950">
                {new Date().getFullYear()} Ambagan &bull; v
                {Constants.expoConfig?.version ?? "1.0.0"}
              </Text>
            </HStack>
          </VStack>
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
