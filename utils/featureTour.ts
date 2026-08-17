import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Bump when the slides change enough that people who've already seen the tour
 * should see it again — the key is versioned, so a bump re-shows it once for
 * everybody without needing a migration.
 */
export const FEATURE_TOUR_VERSION = "v1";

// Keyed per user: a shared device shouldn't hide the tour from the second
// person to sign in just because the first one dismissed it.
const key = (userId: string) =>
  `@feature_tour_seen:${userId}:${FEATURE_TOUR_VERSION}`;

/**
 * Fails *closed* — an unreadable store reports "already seen". Reporting
 * "unseen" would pop the tour on every single launch for anyone whose
 * AsyncStorage is broken, and the tour is a nicety; being trapped behind one
 * is not.
 */
export const getTourSeen = async (userId: string): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(key(userId))) === "true";
  } catch {
    return true;
  }
};

export const setTourSeen = async (userId: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(key(userId), "true");
  } catch {
    // ignore — worst case they see it once more
  }
};
