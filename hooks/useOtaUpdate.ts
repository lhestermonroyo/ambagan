import * as offlineQueue from "@/utils/offlineQueue";
import * as Updates from "expo-updates";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

/**
 * How long the app must have been in the background before a pending JS bundle
 * is allowed to swap itself in.
 *
 * `Updates.reloadAsync()` restarts the JS runtime: every screen unmounts, and
 * anything held only in memory — a half-typed expense, an open sheet, scroll
 * position — is gone. Doing that to someone who tabbed out to check a receipt
 * photo and came straight back would be indistinguishable from a crash. After a
 * few minutes away, a fresh Home screen is what they expect anyway.
 */
const MIN_BACKGROUND_MS = 10 * 60 * 1000; // 10 minutes

/**
 * The silent half of the update story: JS-only changes install themselves, with
 * no prompt and no App Store round trip.
 *
 * expo-updates already downloads a matching update in the background on launch
 * (`checkAutomatically: ON_LOAD` in app.json) and applies it on the NEXT cold
 * launch. This hook only shortens that wait — on a foreground return from a
 * long background, it swaps in an update that's already on disk rather than
 * waiting for the user to fully quit the app, which on iOS many people never
 * deliberately do.
 *
 * What it deliberately does NOT do:
 *   * fetch on a metered connection mid-session — the launch check already
 *     handles acquisition; this is about applying what's there;
 *   * reload while writes are still queued — see the pending-count guard;
 *   * run in development, where `Updates.isEnabled` is false and a reload would
 *     fight the dev-client's own bundle.
 *
 * Native releases are out of scope by construction — a new binary can't arrive
 * this way, which is exactly why {@link useAppUpdate} exists alongside it.
 */
export function useOtaUpdate() {
  const backgroundedAt = useRef<number | null>(null);
  const reloading = useRef(false);

  // `isUpdatePending` is only exposed through this hook, not as a module
  // constant — so it's mirrored into a ref for the AppState listener below,
  // which is mount-scoped and would otherwise close over its launch-time value.
  const { isUpdatePending } = Updates.useUpdates();
  const updatePending = useRef(isUpdatePending);

  useEffect(() => {
    updatePending.current = isUpdatePending;
  }, [isUpdatePending]);

  useEffect(() => {
    // False in Expo Go and in dev builds, and whenever the binary shipped
    // without updates configured — every one of which is a case where reloading
    // would be wrong rather than merely useless.
    if (!Updates.isEnabled) return;

    const sub = AppState.addEventListener("change", async (next) => {
      if (next !== "active") {
        backgroundedAt.current = Date.now();
        return;
      }

      const since = backgroundedAt.current;
      backgroundedAt.current = null;

      if (reloading.current) return;
      if (since === null || Date.now() - since < MIN_BACKGROUND_MS) return;

      try {
        // Never restart on top of unsynced work. The queue is durable in SQLite
        // so nothing would actually be lost, but a reload mid-flush re-runs ops
        // whose network call was already in flight, and the retry path is worth
        // not exercising for a cosmetic head start on an update that would
        // apply on the next launch regardless.
        if ((await offlineQueue.getPendingCount()) > 0) return;

        // Already downloaded by the launch check — the common case, and free.
        if (updatePending.current) {
          reloading.current = true;
          await Updates.reloadAsync();
          return;
        }

        const { isAvailable } = await Updates.checkForUpdateAsync();
        if (!isAvailable) return;

        await Updates.fetchUpdateAsync();
        reloading.current = true;
        await Updates.reloadAsync();
      } catch {
        // Offline, a rolled-back update, a fetch that failed halfway — all of
        // them leave the running bundle intact, which is a fine place to stay.
        reloading.current = false;
      }
    });

    return () => sub.remove();
  }, []);
}
