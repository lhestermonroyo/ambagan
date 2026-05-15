import { HapticTab } from "@/components/haptic-tab";
import OfflineBanner from "@/components/OfflineBanner";
import TabButton from "@/components/TabButton";
import { View } from "@/components/ui/view";
import PushNotificationPermissionSheet from "@/features/user/components/PushNotificationPermissionSheet";
import { useNetwork } from "@/hooks/useNetwork";
import states from "@/states";
import { getSecondaryHex } from "@/utils/getColorHex";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Tabs } from "expo-router";
import React, { useEffect, useState } from "react";
import { useColorScheme } from "react-native";

const PUSH_ASKED_KEY = "@push_permission_asked";

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? "light";
  const [permissionSheetOpen, setPermissionSheetOpen] = useState(false);
  const { details: userDetails } = states.user();
  const { isOnline } = useNetwork();
  const isPro = userDetails?.plan === "pro";
  const showOfflineBanner = !isOnline && isPro;

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
        screenOptions={{
          headerShown: false,
          animation: "fade",
          tabBarActiveTintColor: "#3B82F6",
          tabBarInactiveTintColor: "red",
          tabBarStyle: {
            backgroundColor:
              colorScheme === "dark"
                ? getSecondaryHex("text-secondary-100", colorScheme)
                : getSecondaryHex("text-secondary-0", colorScheme),
            borderTopWidth: 0,
            boxShadow: "0px 0px 10px rgba(0, 0, 0, 0.1)",
            height: 85,
            paddingHorizontal: 12,
            paddingTop: 10,
            paddingBottom: 25
          },
          tabBarButton: HapticTab
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarButton: (props) => <TabButton {...props} label="Overview" />
          }}
        />
        <Tabs.Screen
          name="groups"
          options={{
            tabBarButton: (props) => <TabButton {...props} label="Groups" />
          }}
        />
        <Tabs.Screen
          name="friends"
          options={{
            tabBarButton: (props) => <TabButton {...props} label="Friends" />
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            tabBarButton: (props) => <TabButton {...props} label="Profile" />
          }}
        />
      </Tabs>

      <PushNotificationPermissionSheet
        isOpen={permissionSheetOpen}
        onClose={handleClose}
      />
    </View>
  );
}
