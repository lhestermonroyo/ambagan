import * as Haptics from "expo-haptics";
import { AppState, Platform } from "react-native";

/** Cosmetic feedback after a completed user action; never delay navigation or
 * turn a saved action into an error when haptics are unavailable. */
export async function successHaptic(): Promise<void> {
  if (AppState.currentState !== "active") return;

  try {
    if (Platform.OS === "ios") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (Platform.OS === "android") {
      await Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm);
    }
  } catch {
    // Devices and system settings may not support or allow haptics.
  }
}
