/** A row of `app_versions_tbl` — one per platform. */
export type AppVersionRow = {
  platform: "ios" | "android";
  latest_version: string;
  /** Anything strictly below this is blocked outright. '0.0.0' blocks nobody. */
  min_supported_version: string;
  release_notes: string[];
  store_url: string;
  is_active: boolean;
  updated_at: string;
};

/**
 * What the app does about the row it read.
 *
 *  * `current`  — nothing to show. Also what an unreachable check, a missing
 *                 row, or `is_active = false` resolves to: the gate fails open,
 *                 because a network blip must never look like a stale build.
 *  * `optional` — a newer version exists. Dismissible, and snoozed per version.
 *  * `required` — this build is below the supported floor. No dismiss.
 */
export type UpdateStatus = "current" | "optional" | "required";

export type UpdateGate = {
  status: UpdateStatus;
  /** The version this build reports (`expo-application`). */
  installedVersion: string;
  latestVersion: string;
  releaseNotes: string[];
  storeUrl: string;
};
