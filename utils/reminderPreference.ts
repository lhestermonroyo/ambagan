import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "daily_settlement_reminder_enabled";

export const getReminderEnabled = async (): Promise<boolean> => {
  try {
    const val = await AsyncStorage.getItem(KEY);
    return val === null ? true : val === "true"; // default on
  } catch {
    return true;
  }
};

export const setReminderEnabled = async (enabled: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEY, enabled ? "true" : "false");
  } catch {
    // ignore
  }
};
