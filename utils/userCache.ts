import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Persists the signed-in user's profile (+ a couple of UI preferences) so a
 * cold launch while offline can hydrate immediately, instead of stranding the
 * app with `details = null` when the network fetch fails. Keyed by userId so a
 * different account never sees a previous user's cached profile.
 */
const KEY = "@cached_user_session_v1";

export type CachedUserSession = {
  userId: string;
  details: any;
  appearanceMode?: string;
  defaultCurrency?: string;
};

export const setCachedUserSession = async (
  data: CachedUserSession
): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // best-effort
  }
};

export const getCachedUserSession = async (
  userId: string
): Promise<CachedUserSession | null> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedUserSession;
    return parsed.userId === userId ? parsed : null;
  } catch {
    return null;
  }
};

export const clearCachedUserSession = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // best-effort
  }
};
