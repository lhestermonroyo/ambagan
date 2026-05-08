import { AppearanceMode, UserState } from "@/types/user";
import { supabase } from "@/utils/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

const APPEARANCE_KEY = "@appearance_mode";
const NOTIFICATIONS_KEY = "@notifications_enabled";
const DEFAULT_CURRENCY_KEY = "@default_currency";

const USER_STATE = create<UserState>((set) => ({
  loading: true,
  session: null,
  details: null,
  appearanceMode: "light",
  notificationsEnabled: true,
  defaultCurrency: "PHP",

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

  setDefaultCurrency: async (userId: string, currency: string) => {
    await AsyncStorage.setItem(
      DEFAULT_CURRENCY_KEY,
      JSON.stringify({ userId, currency })
    );
    set({ defaultCurrency: currency });
  },

  loadPreferences: async (userId?: string) => {
    const [storedAppearance, storedNotifications, storedCurrency] =
      await Promise.all([
        AsyncStorage.getItem(APPEARANCE_KEY),
        AsyncStorage.getItem(NOTIFICATIONS_KEY),
        AsyncStorage.getItem(DEFAULT_CURRENCY_KEY)
      ]);

    const appearanceMode: AppearanceMode =
      storedAppearance === "dark" || storedAppearance === "system"
        ? storedAppearance
        : "light";

    const notificationsEnabled = storedNotifications !== "false";

    let defaultCurrency = "PHP";
    if (storedCurrency) {
      const parsed = JSON.parse(storedCurrency);
      if (!userId || parsed.userId === userId) {
        defaultCurrency = parsed.currency;
      }
    }

    set({ appearanceMode, notificationsEnabled, defaultCurrency });
  }
}));

export default USER_STATE;
