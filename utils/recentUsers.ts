import AsyncStorage from "@react-native-async-storage/async-storage";
import { UserPreview } from "@/types/user";

const RECENT_USERS_KEY = "recent_users";
const MAX_RECENT = 10;

export const getRecentUsers = async (): Promise<UserPreview[]> => {
  try {
    const json = await AsyncStorage.getItem(RECENT_USERS_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
};

export const addRecentUser = async (user: UserPreview): Promise<void> => {
  try {
    const current = await getRecentUsers();
    const deduped = current.filter((u) => u.id !== user.id);
    const updated = [user, ...deduped].slice(0, MAX_RECENT);
    await AsyncStorage.setItem(RECENT_USERS_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
};
