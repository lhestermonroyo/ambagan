import { AppVersionRow, UpdateGate } from "@/types/appVersion";
import { tables } from "@/utils/constants";
import { supabase } from "@/utils/supabase";
import { isOlderThan } from "@/utils/version";
import * as Application from "expo-application";
import { Linking, Platform } from "react-native";

/**
 * Reads `app_versions_tbl` and decides whether this build is behind.
 *
 * The whole module FAILS OPEN. Every failure path — offline, a missing row, a
 * malformed version, `is_active = false` — resolves to `current`, i.e. show
 * nothing. That asymmetry is deliberate: a false "you're current" costs one
 * missed nudge that the next launch re-checks anyway, while a false "you must
 * update" (or worse, a thrown error on the launch path) puts a wall in front of
 * an app that was working fine.
 */

/**
 * What this build reports to the stores. iOS gives CFBundleShortVersionString,
 * Android gives versionName — both the user-facing "1.4.0", not the build
 * number, which is what `app_versions_tbl` stores.
 *
 * Null on a platform that has no native binary (web), which short-circuits the
 * whole check.
 */
export const getInstalledVersion = (): string | null =>
  Application.nativeApplicationVersion;

export const getUpdateGate = async (): Promise<UpdateGate | null> => {
  const installedVersion = getInstalledVersion();
  if (!installedVersion) return null;

  // Only the two platforms the table has rows for. Anything else (web) has no
  // store to send anyone to.
  if (Platform.OS !== "ios" && Platform.OS !== "android") return null;

  const { data, error } = await supabase
    .from(tables.APP_VERSIONS_TBL)
    .select("*")
    .eq("platform", Platform.OS)
    .maybeSingle();

  // Both branches are ordinary, not exceptional: `error` is what an offline
  // launch looks like, and a null row is what every environment looks like
  // before the release-day row is written.
  if (error || !data) return null;

  const row = data as AppVersionRow;
  if (!row.is_active) return null;

  const gate = {
    installedVersion,
    latestVersion: row.latest_version,
    releaseNotes: row.release_notes ?? [],
    storeUrl: row.store_url
  };

  // Floor first — a build below min_supported_version is also below
  // latest_version, and the blocking answer has to win.
  if (isOlderThan(installedVersion, row.min_supported_version)) {
    return { ...gate, status: "required" };
  }

  if (isOlderThan(installedVersion, row.latest_version)) {
    return { ...gate, status: "optional" };
  }

  return { ...gate, status: "current" };
};

/**
 * Opens the stored store URL, preferring the native store app over the browser.
 *
 * Both platforms have a scheme that hands the link straight to the store app,
 * which matters more than it sounds: an https://apps.apple.com link opened in
 * Safari shows a web page with its own "View in App Store" hop, so the user
 * taps twice and lands somewhere that can't actually install. `itms-apps://`
 * and `market://` skip that.
 *
 * Attempted with `openURL` and NOT gated on `canOpenURL`: since iOS 9 the latter
 * answers false for any scheme not listed in LSApplicationQueriesSchemes, and
 * `itms-apps` isn't exempt — so probing first would report "can't open" on a
 * device that opens it perfectly well, and quietly demote every user to the
 * Safari path.
 *
 * The https URL stays the real fallback for a device where the store app is
 * absent or disabled (a managed Android profile, a Play-less device), so the
 * button is never a no-op.
 */
export const openStorePage = async (storeUrl: string): Promise<void> => {
  const deepLink =
    Platform.OS === "ios"
      ? storeUrl.replace(/^https?:\/\//, "itms-apps://")
      : `market://details?id=${Application.applicationId}`;

  try {
    await Linking.openURL(deepLink);
    return;
  } catch {
    // No store app to receive it — fall through to the web listing.
  }

  await Linking.openURL(storeUrl).catch(() => {});
};
