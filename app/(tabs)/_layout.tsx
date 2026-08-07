import { LucideIcon } from "@/components/LucideIcon";
import { View } from "@/components/ui/view";
import PushNotificationPermissionSheet from "@/features/user/components/PushNotificationPermissionSheet";
import services from "@/services";
import states from "@/states";
import { getTourSeen } from "@/utils/featureTour";
import { getPrimaryHex } from "@/utils/getColorHex";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useFocusEffect, useRouter } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useCallback, useEffect, useState } from "react";
import { useColorScheme } from "react-native";

const PUSH_ASKED_KEY = "@push_permission_asked";

/**
 * First-run overlays run one at a time, in this order. Both used to be free to
 * fire the moment user details landed, which put the tour and the notification
 * priming on screen in the same frame.
 *
 * "checking" — deciding whether the tour is owed
 * "showing"  — the tour is up; nothing else may present
 * "done"     — the tour is settled, push priming may go ahead
 */
type FirstRunStep = "checking" | "showing" | "done";

export default function TabLayout() {
  const [permissionSheetOpen, setPermissionSheetOpen] = useState(false);
  const [firstRunStep, setFirstRunStep] = useState<FirstRunStep>("checking");
  const { details: userDetails, session } = states.user();
  const router = useRouter();

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

  // Step 1 — the feature tour. Gated here rather than at the end of onboarding
  // because this is the one place every authenticated arrival converges: fresh
  // signup, returning login, and a restored session on cold launch.
  //
  // A pending group invite routes to /groups/[groupId], which lives outside
  // this layout — so someone who opened the app on an invite link gets the
  // group they came for, and meets the tour on their next visit to a tab.
  useEffect(() => {
    const userId = userDetails?.id;
    if (!userId || firstRunStep !== "checking") return;

    let cancelled = false;
    (async () => {
      const seen = await getTourSeen(userId);
      if (cancelled) return;
      if (seen) {
        setFirstRunStep("done");
        return;
      }
      setFirstRunStep("showing");
      router.push("/feature-tour");
    })();

    return () => {
      cancelled = true;
    };
  }, [userDetails?.id, firstRunStep, router]);

  // The tour is a route on the root stack, so dismissing it — by button, swipe,
  // or back — hands focus back here. That's the signal to move on, and it's the
  // only one that covers every way out of it.
  useFocusEffect(
    useCallback(() => {
      setFirstRunStep((step) => (step === "showing" ? "done" : step));
    }, [])
  );

  // Step 2 — notification priming, once the tour is out of the way.
  useEffect(() => {
    if (!userDetails?.id || firstRunStep !== "done") return;
    checkAndPromptPermission();
  }, [userDetails?.id, firstRunStep]);

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
      {/* `history` (over the default `initialRoute`) makes back land on the tab
        you came from, rather than always on Overview. */}
      <NativeTabs
        tintColor={tintColor}
        minimizeBehavior="onScrollDown"
        backBehavior="history"
        // Android's Material bottom-nav defaults to `auto`, which shows the
        // label only on the selected tab and hides it elsewhere. Force every
        // tab to always render both its icon and label.
        labelVisibilityMode="labeled"
      >
        <NativeTabs.Trigger name="(home)">
          <NativeTabs.Trigger.Icon
            renderingMode="template"
            src={
              <NativeTabs.Trigger.VectorIcon
                family={LucideIcon}
                name="wallet"
              />
            }
          />
          <NativeTabs.Trigger.Label>Overview</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="groups">
          <NativeTabs.Trigger.Icon
            renderingMode="template"
            src={
              <NativeTabs.Trigger.VectorIcon family={LucideIcon} name="house" />
            }
          />
          <NativeTabs.Trigger.Label>Groups</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="books">
          <NativeTabs.Trigger.Icon
            renderingMode="template"
            src={
              <NativeTabs.Trigger.VectorIcon
                family={LucideIcon}
                name="notebook-pen"
              />
            }
          />
          <NativeTabs.Trigger.Label>Books</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="friends">
          <NativeTabs.Trigger.Icon
            renderingMode="template"
            src={
              <NativeTabs.Trigger.VectorIcon family={LucideIcon} name="users" />
            }
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
