import NetworkBanner from "@/components/NetworkBanner";
import OfflineSync from "@/components/OfflineSync";
import { Box } from "@/components/ui/box";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import "@/global.css";
// Registers nativewind's className→style interop for expo-image so proof-of-
// payment images (and any other expo-image usage) actually render.
import { buildFriendSettlementRoute } from "@/features/notifications/utils/buildFriendSettlementRoute";
import useAppToast, { ToastProvider } from "@/hooks/use-app-toast";
import { useBanner } from "@/hooks/useBanner";
import { useNetwork } from "@/hooks/useNetwork";
import services from "@/services";
import states from "@/states";
import {
  isSettlementNotification,
  NotificationType
} from "@/types/notifications";
import { tables } from "@/utils/constants";
import "@/utils/nativewindInterop";
import { getDb } from "@/utils/offlineDb";
import {
  clearPendingInviteToken,
  getPendingInviteToken
} from "@/utils/pendingInvite";
import { supabase } from "@/utils/supabase";
import {
  clearCachedUserSession,
  getCachedUserSession,
  setCachedUserSession
} from "@/utils/userCache";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { RealtimeChannel } from "@supabase/supabase-js";
import Constants from "expo-constants";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import {
  DefaultTheme,
  SplashScreen,
  Stack,
  ThemeProvider,
  useRouter
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import { useEffect, useMemo, useRef } from "react";
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
  const { colorScheme } = useColorScheme();
  const isDark = (colorScheme ?? "light") === "dark";

  const appBackground = isDark ? "#121212" : "#FFFFFF";
  const navTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        background: appBackground
      }
    }),
    [isDark, appBackground]
  );
  const { loading, appearanceMode, loadPreferences, session } = states.user();
  const { isOnline } = useNetwork();
  const banner = useBanner();
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
    services.auth.configureGoogleSignIn();
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
    } else if (!prevIsOnline.current && isOnline) {
      // Back online — refresh the plan so a subscription change made while
      // offline is reflected without waiting for a cold launch.
      const uid = states.user.getState().details?.id;
      if (uid) refreshPlan(uid);
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
            // Settlement taps mirror the in-app list: open the friend screen
            // with the settlement's sheet auto-opened and its row highlighted.
            if (isSettlementNotification(data.type)) {
              const target =
                await services.notification.getSettlementNotificationTarget(
                  data.referenceId
                );
              if (target) {
                router.push(
                  buildFriendSettlementRoute(
                    data.type,
                    target.friend,
                    target.settlementId
                  ) as any
                );
              } else {
                toast({
                  title: "No longer available",
                  description:
                    "The settlement linked to this notification no longer exists.",
                  type: "info"
                });
              }
              return;
            }

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

  // Re-sync the RevenueCat entitlement into the user's plan and, crucially,
  // RE-CACHE it afterward so the offline profile reflects the latest plan (the
  // launch cache is written before this runs). Called on launch and again on
  // reconnect, so a lapse/upgrade that happened while offline is picked up
  // within seconds of coming back online instead of waiting for a cold launch.
  const refreshPlan = async (id: string) => {
    try {
      const before = states.user.getState();
      const customerInfo = await services.purchase.getCustomerInfo();
      // Pass the stored window so an unexpired (non-renewing) 2-week pass
      // survives the sync; an expired one reverts to free.
      const { plan, plan_expires_at } =
        await services.purchase.syncPlanToSupabase(customerInfo, {
          currentWindowExpiresAt: before.details?.plan_expires_at ?? null
        });
      states.user.setState((prev) => ({
        ...prev,
        details: prev.details
          ? { ...prev.details, plan, plan_expires_at }
          : prev.details
      }));

      const after = states.user.getState();
      if (after.details) {
        await setCachedUserSession({
          userId: id,
          details: after.details,
          appearanceMode: after.appearanceMode,
          defaultCurrency: after.defaultCurrency
        });
      }
    } catch (error) {
      console.error("Failed to refresh plan:", error);
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
      consumePendingInvite();

      // Persist the fresh profile + UI prefs for the next offline cold launch.
      const current = states.user.getState();
      await setCachedUserSession({
        userId: id,
        details: response.data,
        appearanceMode: current.appearanceMode,
        defaultCurrency: current.defaultCurrency
      });

      await refreshPlan(id);
    } catch (error) {
      console.error("Error fetching user details:", error);
      // Likely offline or a transient error (an authoritative "no row" is
      // handled above, not here). Let an existing session through to the tabs,
      // which read from cache — don't strand the user on the splash.
      states.user.setState((prev) => ({ ...prev, routeIntent: "tabs" }));
    }
  };

  const consumePendingInvite = async () => {
    try {
      const token = await getPendingInviteToken();
      if (!token) return;
      const groupId = await services.group.joinGroupByToken(token);
      await clearPendingInviteToken();
      router.push(`/groups/${groupId}` as any);
    } catch {
      // silently ignore — stale/invalid token, don't block the user
      await clearPendingInviteToken();
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
            <ThemeProvider value={navTheme}>
              {/* Reserve the banner's full height (safe-area inset + content
                  row) so the whole stack — and every native header inside it —
                  drops clear of the absolutely-positioned banner below. A
                  shorter spacer lets UIKit shrink each header's own top inset,
                  landing its title/buttons back under the banner. */}
              {banner.visible && <Box style={{ height: banner.height - 4 }} />}
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: "simple_push",
                  contentStyle: { backgroundColor: appBackground }
                }}
              />
              <StatusBar style="auto" />
              <OfflineSync />
              <NetworkBanner />
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
