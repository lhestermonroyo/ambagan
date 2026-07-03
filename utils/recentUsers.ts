import AsyncStorage from "@react-native-async-storage/async-storage";
import { UserPreview } from "@/types/user";

const MAX_RECENT = 50;

const key = (userId: string) => `recent_users_${userId}`;

export const getRecentUsers = async (userId: string): Promise<UserPreview[]> => {
  try {
    const json = await AsyncStorage.getItem(key(userId));
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
};

// Placeholder ghosts (phone contacts not yet claimed by a real account) must
// never live in the recent list — their id is unstable (temp `contact:<phone>`
// before resolution, a real UUID after), so they show up as duplicates in the
// Friends tab. Filtering here makes that invariant hold for every call site, and
// scrubs any ghosts already persisted from before this guard existed.
const isRecentable = (u: UserPreview) => !u.is_placeholder;

export const addRecentUser = async (user: UserPreview, userId: string): Promise<void> => {
  try {
    const current = (await getRecentUsers(userId)).filter(isRecentable);
    if (!isRecentable(user)) {
      // Nothing to add, but persist the scrub of any pre-existing ghosts.
      await AsyncStorage.setItem(key(userId), JSON.stringify(current));
      return;
    }
    const deduped = current.filter((u) => u.id !== user.id);
    const updated = [user, ...deduped].slice(0, MAX_RECENT);
    await AsyncStorage.setItem(key(userId), JSON.stringify(updated));
  } catch {
    // ignore
  }
};

export const addRecentUsers = async (users: UserPreview[], userId: string): Promise<void> => {
  try {
    const clean = users.filter(isRecentable);
    const current = (await getRecentUsers(userId)).filter(isRecentable);
    const newIds = new Set(clean.map((u) => u.id));
    const deduped = current.filter((u) => !newIds.has(u.id));
    const updated = [...clean, ...deduped].slice(0, MAX_RECENT);
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
