import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import "@/global.css";
import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";
import {
  configureReanimatedLogger,
  ReanimatedLogLevel
} from "react-native-reanimated";

export const unstable_settings = {
  anchor: "(tabs)"
};

export default function RootLayout() {
  const [loaded] = useFonts({
    "GoogleSans-Regular": require("@/assets/fonts/GoogleSans-Regular.ttf"),
    "GoogleSans-Italic": require("@/assets/fonts/GoogleSans-Italic.ttf"),
    "GoogleSans-Medium": require("@/assets/fonts/GoogleSans-Medium.ttf"),
    "GoogleSans-MediumItalic": require("@/assets/fonts/GoogleSans-MediumItalic.ttf"),
    "GoogleSans-Bold": require("@/assets/fonts/GoogleSans-Bold.ttf"),
    "GoogleSans-BoldItalic": require("@/assets/fonts/GoogleSans-BoldItalic.ttf")
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <GluestackUIProvider mode="light">
      <ThemeProvider value={DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login/index" />
          <Stack.Screen name="sign-up/index" />
          <Stack.Screen name="forgot-password/index" />
          <Stack.Screen name="(tabs)" />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GluestackUIProvider>
  );
}

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false // Reanimated runs in strict mode by default
});
