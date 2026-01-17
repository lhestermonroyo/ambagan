import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider
} from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import '@/global.css';
import { useEffect } from 'react';

export const unstable_settings = {
  anchor: '(tabs)'
};

export default function RootLayout() {
  const [loaded] = useFonts({
    Outfit: require('@/assets/fonts/Outfit-Regular.ttf'),
    'Outfit-Medium': require('@/assets/fonts/Outfit-Medium.ttf'),
    'Outfit-Bold': require('@/assets/fonts/Outfit-Bold.ttf')
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  const colorScheme = useColorScheme();

  return (
    <GluestackUIProvider mode="light">
      <ThemeProvider value={colorScheme === 'light' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GluestackUIProvider>
  );
}
