import { AppearanceMode, UserState } from "@/types/user";
import { supabase } from "@/utils/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

const APPEARANCE_KEY = "@appearance_mode";
const NOTIFICATIONS_KEY = "@notifications_enabled";

const USER_STATE = create<UserState>((set) => ({
  loading: true,
  session: null,
  details: null,
  appearanceMode: "light",
  notificationsEnabled: true,

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, details: null });
  },

  setAppearanceMode: async (mode: AppearanceMode) => {
    await AsyncStorage.setItem(APPEARANCE_KEY, mode);
    set({ appearanceMode: mode });
  },

  setNotificationsEnabled: async (enabled: boolean) => {
    await AsyncStorage.setItem(NOTIFICATIONS_KEY, String(enabled));
    set({ notificationsEnabled: enabled });
  },

  loadPreferences: async () => {
    const [storedAppearance, storedNotifications] = await Promise.all([
      AsyncStorage.getItem(APPEARANCE_KEY),
      AsyncStorage.getItem(NOTIFICATIONS_KEY)
    ]);

    const appearanceMode: AppearanceMode =
      storedAppearance === "dark" || storedAppearance === "system"
        ? storedAppearance
        : "light";

    const notificationsEnabled = storedNotifications !== "false";

    set({ appearanceMode, notificationsEnabled });
  }
}));

export default USER_STATE;
