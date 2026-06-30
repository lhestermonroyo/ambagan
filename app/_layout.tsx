import OfflineBanner from "@/components/OfflineBanner";
import OfflineSync from "@/components/OfflineSync";
import SlowConnectionBanner from "@/components/SlowConnectionBanner";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import "@/global.css";
import useAppToast, { ToastProvider } from "@/hooks/use-app-toast";
import { useNetwork } from "@/hooks/useNetwork";
import { useNetworkHealth } from "@/hooks/useNetworkHealth";
import services from "@/services";
import states from "@/states";
import { NotificationType } from "@/types/notifications";
import { tables } from "@/utils/constants";
import { getDb } from "@/utils/offlineDb";
import { supabase } from "@/utils/supabase";
import {
  clearCachedUserSession,
  getCachedUserSession,
  setCachedUserSession
} from "@/utils/userCache";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { RealtimeChannel } from "@supabase/supabase-js";
import Constants from "expo-constants";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { SplashScreen, Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
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
  const { loading, appearanceMode, loadPreferences, session } = states.user();
  const { isOnline } = useNetwork();
  const { isDegraded } = useNetworkHealth();
  const toast = useAppToast();
  const overlayOpacity = useSharedValue(0);
  const isFirstRender = useRef(true);
  const prevIsOnline = useRef<boolean | null>(null);
  const notificationChannel = useRef<RealtimeChannel | null>(null);
  const subscribedUserId = useRef<string | null>(null);
  const fetchedForUser = useRef<string | null>(null);
  const notifReceivedListener = useRef<Notifications.EventSubscription | null>(
    null
  );
  const notifResponseListener = useRef<Notifications.EventSubscription | null>(
    null
  );

  useEffect(() => {
    loadPreferences();
    getDb().catch(() => {});
  }, []);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) {
      fetchedForUser.current = null;
      return;
    }
    if (fetchedForUser.current === uid) return; // already fetched for this user
    fetchedForUser.current = uid;
    fetchDetails(uid);
  }, [session?.user?.id]);

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
    if (prevIsOnline.current === null) {
      prevIsOnline.current = isOnline;
      return;
    }
    if (prevIsOnline.current && !isOnline) {
      toast({
        title: "No Internet Connection",
        description:
          "You're in offline mode. You can still browse cached data.",
        type: "error"
      });
    }
    prevIsOnline.current = isOnline;
  }, [isOnline]);

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
            if (route) {
              router.push(route as any);
            } else {
              toast({
                title: "No longer available",
                description:
                  "The group or expense linked to this notification no longer exists.",
                type: "info"
              });
            }
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
      .then(({ data: { session } }) => {
        if (!session) {
          states.user.setState((prev) => ({ ...prev, routeIntent: "welcome" }));
          return;
        }

        states.user.setState((prev) => ({ ...prev, session }));
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
        if (states.user.getState().session) return;

        unsubscribeNotifications();
        try {
          const { status } = await Notifications.getPermissionsAsync();
          if (status === "granted") {
            const { data: token } = await Notifications.getExpoPushTokenAsync({
              projectId: Constants.expoConfig?.extra?.eas?.projectId
            });
            await services.pushToken.removePushToken(token);
          }
        } catch {
          // silently ignore — don't block session cleanup if token removal fails
        }
        return;
      }

      states.user.setState((prev) => ({ ...prev, session }));
      // fetchDetails is called by the useEffect([session?.user?.id]) above
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

          const notification = await services.notification.getNotificationById(
            record.id
          );

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
    // Hydrate from the local cache FIRST so the app is usable offline right away,
    // independent of the network (which may be down or slow on a cold launch).
    // The network fetch below refreshes this once it succeeds.
    try {
      const cached = await getCachedUserSession(id);
      if (cached?.details) {
        states.user.setState((prev) => ({
          ...prev,
          details: cached.details,
          ...(cached.appearanceMode && {
            appearanceMode: cached.appearanceMode as typeof prev.appearanceMode
          }),
          ...(cached.defaultCurrency && {
            defaultCurrency: cached.defaultCurrency
          }),
          routeIntent: "tabs"
        }));
      }
    } catch {
      // best-effort — fall through to the network fetch
    }

    try {
      const response = await services.user.getUserById(id);

      if (response.message === "User not found" && !response.data) {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (!authError && authData?.user) {
          states.user.setState((prev) => ({
            ...prev,
            details: null,
            routeIntent: "onboarding"
          }));
          return;
        }

        await clearCachedUserSession();
        await supabase.auth.signOut();
        states.user.setState((prev) => ({
          ...prev,
          session: null,
          details: null,
          routeIntent: "login"
        }));
        return;
      }

      states.user.setState((prev) => ({
        ...prev,
        details: response.data,
        routeIntent: "tabs"
      }));

      await loadPreferences(id);
      subscribeToNotifications(id);
      registerDevicePushToken(id);
      services.purchase.initializePurchases(id);

      // Persist the fresh profile + UI prefs for the next offline cold launch.
      const current = states.user.getState();
      await setCachedUserSession({
        userId: id,
        details: response.data,
        appearanceMode: current.appearanceMode,
        defaultCurrency: current.defaultCurrency
      });

      try {
        const customerInfo = await services.purchase.getCustomerInfo();
        // Pass the stored window so an unexpired (non-renewing) 2-week pass
        // survives the launch sync; an expired one reverts to free.
        const { plan, plan_expires_at } =
          await services.purchase.syncPlanToSupabase(customerInfo, {
            currentWindowExpiresAt: response.data?.plan_expires_at ?? null
          });
        states.user.setState((prev) => ({
          ...prev,
          details: prev.details
            ? { ...prev.details, plan, plan_expires_at }
            : prev.details
        }));
      } catch (error) {
        console.error("Failed to sync plan on launch:", error);
      }
    } catch (error) {
      console.error("Error fetching user details:", error);
      // Likely offline or a transient error (an authoritative "no row" is
      // handled above, not here). Let an existing session through to the tabs,
      // which read from cache — don't strand the user on the splash.
      states.user.setState((prev) => ({ ...prev, routeIntent: "tabs" }));
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <GluestackUIProvider mode={appearanceMode}>
          <ToastProvider>
            <ThemeProvider value={DefaultTheme}>
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: "simple_push"
                }}
              />
              <StatusBar style="auto" />
              <OfflineSync />
              {!isOnline && <OfflineBanner />}
              {isOnline && isDegraded && <SlowConnectionBanner />}
            </ThemeProvider>
          </ToastProvider>
        </GluestackUIProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false // Reanimated runs in strict mode by default
});
