import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import "@/global.css";
import { ToastProvider } from "@/hooks/use-app-toast";
import services from "@/services";
import states from "@/states";
import { supabase } from "@/utils/supabase";
import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { SplashScreen, Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";
import {
  configureReanimatedLogger,
  ReanimatedLogLevel
} from "react-native-reanimated";

export default function RootLayout() {
  const [loaded] = useFonts({
    "GoogleSans-Regular": require("@/assets/fonts/GoogleSans-Regular.ttf"),
    "GoogleSans-Italic": require("@/assets/fonts/GoogleSans-Italic.ttf"),
    "GoogleSans-Medium": require("@/assets/fonts/GoogleSans-Medium.ttf"),
    "GoogleSans-MediumItalic": require("@/assets/fonts/GoogleSans-MediumItalic.ttf"),
    "GoogleSans-Bold": require("@/assets/fonts/GoogleSans-Bold.ttf"),
    "GoogleSans-BoldItalic": require("@/assets/fonts/GoogleSans-BoldItalic.ttf")
  });
  const router = useRouter();
  const { loading, appearanceMode, loadPreferences } = states.user();

  useEffect(() => {
    loadPreferences();
  }, []);

  useEffect(() => {
    if (loaded && !loading) {
      SplashScreen.hideAsync();
    }
  }, [loaded, loading]);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        if (!session) return;

        states.user.setState((prev) => ({
          ...prev,
          session
        }));

        await fetchDetails(session.user.id);
      })
      .finally(() => {
        states.user.setState((prev) => ({
          ...prev,
          loading: false
        }));
      });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) return;

      states.user.setState((prev) => ({
        ...prev,
        session
      }));

      fetchDetails(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchDetails = async (id: string) => {
    try {
      const response = await services.user.getUserById(id);

      if (response.message === "User not found" && !response.data) {
        router.replace("/(auth)/onboarding");
        return;
      }

      states.user.setState((prev) => ({
        ...prev,
        details: response.data
      }));
    } catch (error) {
      console.error("Error fetching user details:", error);
    }
  };

  if (!loaded || loading) {
    return null;
  }

  return (
    <GluestackUIProvider mode={appearanceMode}>
      <ToastProvider>
        <ThemeProvider value={DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }} />
          <StatusBar style="auto" />
        </ThemeProvider>
      </ToastProvider>
    </GluestackUIProvider>
  );
}

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false // Reanimated runs in strict mode by default
});
