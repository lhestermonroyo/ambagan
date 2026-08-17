import { SplashScreen } from "expo-router";
import { useEffect } from "react";

/** Hide-once guard: whichever landing screen paints first wins, and every
 *  later call (including the watchdog in app/_layout.tsx) is a no-op. */
let hidden = false;

/**
 * Hide the native splash immediately, at most once per launch.
 *
 * Prefer `useHideSplashOnFirstFrame` — this direct form is for the watchdog,
 * which fires when no landing screen got far enough to call the hook.
 */
export function hideSplashNow() {
  if (hidden) return;
  hidden = true;
  // Rejects if the splash is already gone — never let that surface.
  SplashScreen.hideAsync().catch(() => {});
}

/**
 * Hold the native splash until this screen's first frame is actually on
 * screen, then lift it.
 *
 * Call it from a *landing* screen — one that `app/index.tsx` can redirect a
 * cold launch into. Hiding the splash on "auth resolved" instead (which is
 * what the root layout used to do) uncovers the window ~1s before the tab
 * tree finishes mounting, so the launch reads: splash → blank → content.
 * Waiting for a painted frame means the splash lifts straight onto the real
 * screen, skeletons and all.
 */
export function useHideSplashOnFirstFrame() {
  useEffect(() => {
    // Two frames deep on purpose. This effect runs after React commits but
    // before the commit is drawn, and so does the first rAF callback — only
    // the second is guaranteed to run with pixels on screen.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(hideSplashNow);
    });
    return () => {
      cancelAnimationFrame(outer);
      if (inner) cancelAnimationFrame(inner);
    };
  }, []);
}
