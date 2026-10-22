import Logo from "@/components/Logo";
import SocialAuthButtons from "@/components/SocialAuthButtons";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Image } from "@/components/ui/image";
import { Link } from "@/components/ui/link";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useHideSplashOnFirstFrame } from "@/hooks/useHideSplash";
import { useRouter } from "expo-router";
import { useWindowDimensions } from "react-native";

export default function WelcomeScreen() {
  useHideSplashOnFirstFrame();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const illustrationSize = Math.min(320, width - 32);
  const circleSize = illustrationSize * 0.8;

  return (
    <SafeAreaView className="flex-1 bg-background-0">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        bounces={false}
      >
        <VStack className="grow px-4 py-6 gap-y-8">
          <Logo type="auth" />

          <VStack className="grow items-center justify-center gap-y-6 py-4">
            <Box
              className="relative items-center justify-center"
              style={{
                width: illustrationSize,
                height: illustrationSize,
                flexShrink: 0
              }}
            >
              <Box
                className="absolute bg-primary-0 dark:bg-primary-50"
                style={{
                  width: circleSize,
                  height: circleSize,
                  borderRadius: circleSize / 2
                }}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
              <Image
                source={require("@/assets/illustrations/ambagan-shared-expenses.png")}
                size="full"
                alt="Friends splitting a receipt beside a personal expense notebook"
                resizeMode="contain"
              />
            </Box>

            <VStack className="items-center gap-y-3">
              <Text bold size="3xl" className="text-center">
                For Everything You Chip In
              </Text>
              <Text className="text-lg text-secondary-950 text-center">
                Rent, groceries, lunch with friends. Keep shared bills and your
                own spending in one place.
              </Text>
            </VStack>
          </VStack>

          <SocialAuthButtons
            onEmailLogin={() => router.push("/(auth)/login")}
          />

          <HStack className="items-center justify-center flex-wrap gap-x-1">
            <Text className="text-lg text-secondary-950">No account yet?</Text>
            <Link onPress={() => router.push("/(auth)/sign-up")}>
              <Text className="text-lg font-medium text-primary-400">
                Sign Up
              </Text>
            </Link>
          </HStack>
        </VStack>
      </ScrollView>
    </SafeAreaView>
  );
}
