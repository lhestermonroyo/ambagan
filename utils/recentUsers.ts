import AsyncStorage from "@react-native-async-storage/async-storage";
import { UserPreview } from "@/types/user";

const MAX_RECENT = 10;

const key = (userId: string) => `recent_users_${userId}`;

export const getRecentUsers = async (userId: string): Promise<UserPreview[]> => {
  try {
    const json = await AsyncStorage.getItem(key(userId));
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
};

export const addRecentUser = async (user: UserPreview, userId: string): Promise<void> => {
  try {
    const current = await getRecentUsers(userId);
    const deduped = current.filter((u) => u.id !== user.id);
    const updated = [user, ...deduped].slice(0, MAX_RECENT);
    await AsyncStorage.setItem(key(userId), JSON.stringify(updated));
  } catch {
    // ignore
  }
};

export const addRecentUsers = async (users: UserPreview[], userId: string): Promise<void> => {
  try {
    const current = await getRecentUsers(userId);
    const newIds = new Set(users.map((u) => u.id));
    const deduped = current.filter((u) => !newIds.has(u.id));
    const updated = [...users, ...deduped].slice(0, MAX_RECENT);
    await AsyncStorage.setItem(key(userId), JSON.stringify(updated));
  } catch {
    // ignore
  }
};

export const removeRecentUser = async (targetUserId: string, userId: string): Promise<void> => {
  try {
    const current = await getRecentUsers(userId);
    const updated = current.filter((u) => u.id !== targetUserId);
    await AsyncStorage.setItem(key(userId), JSON.stringify(updated));
  } catch {
    // ignore
  }
};
