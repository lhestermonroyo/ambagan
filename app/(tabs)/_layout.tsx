import { LucideIcon } from "@/components/LucideIcon";
import { View } from "@/components/ui/view";
import PushNotificationPermissionSheet from "@/features/user/components/PushNotificationPermissionSheet";
import services from "@/services";
import states from "@/states";
import { getPrimaryHex } from "@/utils/getColorHex";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useEffect, useState } from "react";
import { useColorScheme } from "react-native";

const PUSH_ASKED_KEY = "@push_permission_asked";

export default function TabLayout() {
  const [permissionSheetOpen, setPermissionSheetOpen] = useState(false);
  const { details: userDetails, session } = states.user();

  // Safety net: if we have a session but no user details yet, refetch
  useEffect(() => {
    if (!session?.user?.id || userDetails?.id) return;
    services.user
      .getUserById(session.user.id)
      .then((res) => {
        if (res.data) {
          states.user.setState((prev) => ({ ...prev, details: res.data }));
        }
      })
      .catch(() => {});
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

  const colorScheme = useColorScheme() ?? "light";
  // Brand purple for the selected tab; light/dark handled by getPrimaryHex.
  const tintColor = getPrimaryHex("text-primary-600", colorScheme);

  return (
    <View style={{ flex: 1 }}>
      <NativeTabs tintColor={tintColor} minimizeBehavior="onScrollDown">
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon
            renderingMode="template"
            src={<NativeTabs.Trigger.VectorIcon family={LucideIcon} name="wallet" />}
          />
          <NativeTabs.Trigger.Label>Overview</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="groups">
          <NativeTabs.Trigger.Icon
            renderingMode="template"
            src={<NativeTabs.Trigger.VectorIcon family={LucideIcon} name="house" />}
          />
          <NativeTabs.Trigger.Label>Groups</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="friends">
          <NativeTabs.Trigger.Icon
            renderingMode="template"
            src={<NativeTabs.Trigger.VectorIcon family={LucideIcon} name="users" />}
          />
          <NativeTabs.Trigger.Label>Friends</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Icon
            renderingMode="template"
            src={
              <NativeTabs.Trigger.VectorIcon
                family={LucideIcon}
                name="circle-user"
              />
            }
          />
          <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>

      <PushNotificationPermissionSheet
        isOpen={permissionSheetOpen}
        onClose={handleClose}
      />
    </View>
  );
}
