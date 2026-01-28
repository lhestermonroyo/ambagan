import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import '@/global.css';
import services from '@/services';
import states from '@/states';
import { supabase } from '@/utils/supabase';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import 'react-native-reanimated';
import {
  configureReanimatedLogger,
  ReanimatedLogLevel
} from 'react-native-reanimated';

export const unstable_settings = {
  anchor: '(tabs)'
};

export default function RootLayout() {
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const isMounted = useRef(false);

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
      isMounted.current = true;
    }
  }, [loaded]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      states.auth.setState((prev) => ({
        ...prev,
        session
      }));

      fetchUser(session?.user.id!);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      states.auth.setState((prev) => ({
        ...prev,
        session
      }));

      fetchUser(session?.user.id!);
    });

    return () => {
      if (data.subscription) {
        data.subscription.unsubscribe();
      }
    };
  }, []);

  const fetchUser = async (id: string) => {
    try {
      const response = await services.user.getUserById(id);

      if (response) {
        states.auth.setState((prev) => ({
          ...prev,
          user: response
        }));
        router.push('/(tabs)/home');
      }
    } catch (error) {
      console.log('Error fetching user:', error);
      states.auth.setState((prev) => ({
        ...prev,
        session: null,
        user: null
      }));
    } finally {
      setLoading(false);
    }
  };

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
