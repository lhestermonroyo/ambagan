import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * How long "Later" buys. Long enough that the prompt isn't a launch tax, short
 * enough that someone who keeps tapping Later still lands on a supported build
 * within a release cycle.
 */
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

/**
 * Keyed by the version being ADVERTISED, not by the installed one. A snooze
 * therefore covers exactly the release it was granted for: ignoring 1.5.0 for
 * three days says nothing about 1.6.0, which prompts on the next launch after
 * it lands.
 *
 * Not keyed per user, unlike the feature tour — an out-of-date binary is a
 * property of the device, and re-nagging the second person to sign in about an
 * update the first one just deferred would be noise, not safety.
 */
const key = (version: string) => `@update_prompt_snoozed:${version}`;

/**
 * Fails *closed* — an unreadable store reports "snoozed". The alternative pops
 * a modal on every single launch for anyone whose AsyncStorage is broken. A
 * REQUIRED update never consults this, so the failure mode can't hide a build
 * that genuinely has to go.
 */
export const isUpdateSnoozed = async (version: string): Promise<boolean> => {
  try {
    const raw = await AsyncStorage.getItem(key(version));
    if (!raw) return false;

    const at = Number.parseInt(raw, 10);
    if (!Number.isFinite(at)) return false;

    // A clock that moved backwards (timezone edit, manual set) would otherwise
    // leave a future timestamp snoozing forever, so treat it as expired.
    const age = Date.now() - at;
    if (age < 0) return false;

    return age < SNOOZE_MS;
  } catch {
    return true;
  }
};

export const snoozeUpdate = async (version: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(key(version), String(Date.now()));
  } catch {
    // ignore — worst case they're asked again next launch
  }
};
