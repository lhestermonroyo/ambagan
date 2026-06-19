import CustomTabBar from "@/components/CustomTabBar";
import OfflineBanner from "@/components/OfflineBanner";
import { View } from "@/components/ui/view";
import PushNotificationPermissionSheet from "@/features/user/components/PushNotificationPermissionSheet";
import { useNetwork } from "@/hooks/useNetwork";
import services from "@/services";
import states from "@/states";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Tabs } from "expo-router";
import React, { useEffect, useState } from "react";

const PUSH_ASKED_KEY = "@push_permission_asked";

export default function TabLayout() {
  const [permissionSheetOpen, setPermissionSheetOpen] = useState(false);
  const { details: userDetails, session } = states.user();
  const { isOnline } = useNetwork();
  const isPro = userDetails?.plan === "pro";
  const showOfflineBanner = !isOnline && isPro;

  // Safety net: if we have a session but no user details yet, refetch
  useEffect(() => {
    if (!session?.user?.id || userDetails?.id) return;
    services.user.getUserById(session.user.id).then((res) => {
      if (res.data) {
        states.user.setState((prev) => ({ ...prev, details: res.data }));
      }
    }).catch(() => {});
  }, [session?.user?.id, userDetails?.id]);

  useEffect(() => {
    if (!userDetails?.id) return;
    checkAndPromptPermission();
  }, [userDetails?.id]);

  const checkAndPromptPermission = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status === "granted") return;

      const alreadyAsked = await AsyncStorage.getItem(PUSH_ASKED_KEY);
      if (alreadyAsked) return;

      setPermissionSheetOpen(true);
    } catch {
      // silently fail — don't block the user from using the app
    }
  };

  const handleClose = async () => {
    setPermissionSheetOpen(false);
    try {
      await AsyncStorage.setItem(PUSH_ASKED_KEY, "true");
    } catch {}
  };

  return (
    <View style={{ flex: 1 }}>
      {showOfflineBanner && <OfflineBanner />}
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          animation: "none"
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="groups" />
        <Tabs.Screen name="friends" />
        <Tabs.Screen name="profile" />
      </Tabs>

      <PushNotificationPermissionSheet
        isOpen={permissionSheetOpen}
        onClose={handleClose}
      />
    </View>
  );
}
