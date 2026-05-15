import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import "@/global.css";
import { ToastProvider } from "@/hooks/use-app-toast";
import services from "@/services";
import states from "@/states";
import { NotificationType } from "@/types/notifications";
import { tables } from "@/utils/constants";
import { getDb } from "@/utils/offlineDb";
import { supabase } from "@/utils/supabase";
import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { RealtimeChannel } from "@supabase/supabase-js";
import Constants from "expo-constants";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { SplashScreen, Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { StyleSheet } from "react-native";

import Animated, {
  configureReanimatedLogger,
  ReanimatedLogLevel,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming
} from "react-native-reanimated";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

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
  const overlayOpacity = useSharedValue(0);
  const isFirstRender = useRef(true);
  const notificationChannel = useRef<RealtimeChannel | null>(null);
  const subscribedUserId = useRef<string | null>(null);
  const notifReceivedListener = useRef<Notifications.EventSubscription | null>(null);
  const notifResponseListener = useRef<Notifications.EventSubscription | null>(null);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value
  }));

  useEffect(() => {
    loadPreferences();
    getDb().catch(() => {});
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    overlayOpacity.value = withSequence(
      withTiming(1, { duration: 100 }),
      withTiming(0, { duration: 400 })
    );
  }, [appearanceMode]);

  useEffect(() => {
    if (loaded && !loading) {
      SplashScreen.hideAsync();
    }
  }, [loaded, loading]);

  useEffect(() => {
    notifReceivedListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        const data = notification.request.content.data as {
          type?: NotificationType;
          referenceId?: string;
        };

        if (!data?.type) return;

        states.notification.setState((prev) => ({
          ...prev,
          unreadCount: prev.unreadCount + 1
        }));
      });

    notifResponseListener.current =
      Notifications.addNotificationResponseReceivedListener(
        async (response) => {
          const data = response.notification.request.content.data as {
            type?: NotificationType;
            referenceId?: string;
          };

          if (!data?.type || !data?.referenceId) return;

          try {
            const route = await services.notification.getNotificationRoute(
              data.type,
              data.referenceId
            );
            if (route) router.push(route as any);
          } catch {
            // silently ignore — don't crash on a bad tap
          }
        }
      );

    return () => {
      notifReceivedListener.current?.remove();
      notifResponseListener.current?.remove();
    };
  }, []);

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
      if (_event === "PASSWORD_RECOVERY") {
        router.replace("/(auth)/reset-password");
        return;
      }

      if (!session) {
        unsubscribeNotifications();
        return;
      }

      states.user.setState((prev) => ({
        ...prev,
        session
      }));

      fetchDetails(session.user.id);
    });

    return () => {
      subscription.unsubscribe();
      unsubscribeNotifications();
    };
  }, []);

  const subscribeToNotifications = (userId: string) => {
    if (subscribedUserId.current === userId && notificationChannel.current) {
      return;
    }

    if (notificationChannel.current) {
      supabase.removeChannel(notificationChannel.current);
      notificationChannel.current = null;
    }

    subscribedUserId.current = userId;

    notificationChannel.current = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: tables.NOTIFICATIONS_TBL
        },
        async (payload) => {
          const record = payload.new as { id: string; to_user_id: string };
          if (record.to_user_id !== userId) return;

          const notification =
            await services.notification.getNotificationById(record.id);

          states.notification.setState((prev) => ({
            ...prev,
            unreadCount: prev.unreadCount + 1,
            list: notification ? [notification, ...prev.list] : prev.list
          }));
        }
      )
      .subscribe();
  };

  const unsubscribeNotifications = () => {
    if (notificationChannel.current) {
      supabase.removeChannel(notificationChannel.current);
      notificationChannel.current = null;
      subscribedUserId.current = null;
    }
  };

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

      await loadPreferences(id);
      subscribeToNotifications(id);
      registerDevicePushToken(id);
    } catch (error) {
      console.error("Error fetching user details:", error);
    }
  };

  const registerDevicePushToken = async (userId: string) => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== "granted") return;
      const { data: token } = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId
      });
      await services.pushToken.registerPushToken(userId, token);
    } catch (error) {
      console.error("Failed to register push token:", error);
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
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: appearanceMode === "dark" ? "#000" : "#fff" },
          overlayStyle
        ]}
      />
    </GluestackUIProvider>
  );
}

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false // Reanimated runs in strict mode by default
});
