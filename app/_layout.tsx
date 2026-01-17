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
    'GoogleSans-Regular': require('@/assets/fonts/GoogleSans-Regular.ttf'),
    'GoogleSans-Italic': require('@/assets/fonts/GoogleSans-Italic.ttf'),
    'GoogleSans-Medium': require('@/assets/fonts/GoogleSans-Medium.ttf'),
    'GoogleSans-MediumItalic': require('@/assets/fonts/GoogleSans-MediumItalic.ttf'),
    'GoogleSans-Bold': require('@/assets/fonts/GoogleSans-Bold.ttf'),
    'GoogleSans-BoldItalic': require('@/assets/fonts/GoogleSans-BoldItalic.ttf')
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
