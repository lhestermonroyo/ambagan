# Deployment Checklist — v1.5

Everything v1.5 needs beyond `git merge`. Work top-to-bottom on release day.

**Context — one project, two schemas.** Dev and prod share the single Supabase
project `zwlzyvvhgfmffjzzvrjx`. Environments are split by Postgres schema
(`dev` = dev builds, `public` = prod) and by Edge Function name suffix
(`<name>-dev` = dev, `<name>` = prod). `__DEV__` picks both at runtime
(`utils/supabase.ts`). So every DB change has to be run **twice**, once per
schema.

---

## A. Database migrations

### A1. `2026-08-17_app_versions.sql` — the update gate

[`migrations/2026-08-17_app_versions.sql`](../../../migrations/2026-08-17_app_versions.sql)

Creates `app_versions_tbl` (one row per platform), the `version_tuple()` helper,
the `min_supported_version <= latest_version` constraint, RLS (read-only to
`anon` + `authenticated`), and seeds **1.4.0** for both platforms.

- [ ] **Dev** — run as-is (`SET search_path = dev, public, extensions;`)
- [ ] **Prod** — change the `SET` line to `public, extensions;`, then run
- [ ] Confirm the seed landed: `SELECT * FROM app_versions_tbl;` → two rows,
      `latest_version = '1.4.0'`, `min_supported_version = '0.0.0'`

The seed is deliberately the **currently shipped** version, not 1.5.0. Applying
this migration must not make anyone's app start nagging — arming the gate is a
separate, deliberate step (§D).

---

## B. EAS Update (OTA) — one-time project setup

New in v1.5. Everything JS-only after this ships can reach users without an App
Store round trip.

- [ ] `eas update:configure` — verify it agrees with what's already in
      [`app.json`](../../../app.json) (`updates.url` =
      `https://u.expo.dev/39236d20-59ff-4cad-ba80-20348dda7e2c`,
      `runtimeVersion.policy` = `fingerprint`). It should be a no-op; if it
      rewrites either, take its version.
- [ ] Confirm the channels in [`eas.json`](../../../eas.json) exist in the EAS
      dashboard: `development`, `preview`, `production`.
- [ ] **A native rebuild is mandatory.** expo-updates is a native module; the
      binaries already in TestFlight and the App Store cannot receive OTA
      updates at all, no matter what is published. v1.5's build is the first one
      that can. `ios/` is gitignored, so EAS runs prebuild and wires
      `Expo.plist` itself — no manual native edits.
- [ ] After the build is live, prove the pipe works end-to-end **before**
      relying on it: change a visible string, `yarn update:prod`, then background
      the app for 10+ minutes and return (see `MIN_BACKGROUND_MS` in
      [`useOtaUpdate.ts`](../../../hooks/useOtaUpdate.ts)).

> ⚠️ **Fingerprint policy.** Any change to native config — a new native
> dependency, a plugin, an `app.json` native field — changes the runtime
> fingerprint, so the OTA no longer matches shipped binaries and simply isn't
> delivered. That is the correct behavior (it prevents a JS bundle running
> against native code it wasn't built for), but it means "I published an update
> and nothing happened" is usually a fingerprint mismatch, not a broken pipe.

---

## C. Build & release

- [ ] `yarn build:ios-prod`
- [ ] `yarn submit:ios-prod`
- [ ] Wait for the App Store listing to actually show 1.5.0

---

## D. Arm the gate — **after** the listing is live

Not before. The prompt's Update button deep-links straight to the store page; a
page still serving 1.4.0 makes that button a dead end and the prompt unclosable
for anyone who taps it.

```sql
-- prod (public schema)
UPDATE app_versions_tbl
   SET latest_version = '1.5.0',
       release_notes  = ARRAY[
         'Ambagan now updates itself in the background',
         '…'
       ]
 WHERE platform = 'ios';
```

- [ ] Run it, with real release notes from
      [`CHANGELOG.md`](./CHANGELOG.md)
- [ ] Launch a 1.4.x build and confirm the modal appears, "Not now" dismisses it,
      and it stays away for 3 days (`SNOOZE_MS` in
      [`utils/updatePrompt.ts`](../../../utils/updatePrompt.ts))

**Leave `min_supported_version` at `0.0.0`.** It is an incident tool, not a
release step — raising it strands anyone who *can't* update (old OS, no free
storage) behind a screen with no way out. Use it only to force people off a
build that is actively doing damage:

```sql
UPDATE app_versions_tbl SET min_supported_version = '1.5.1' WHERE platform = 'ios';
```

And the kill switch, if a release is pulled after the row was written:

```sql
UPDATE app_versions_tbl SET is_active = false WHERE platform = 'ios';
```

---

## E. Post-deploy verification

- [ ] Fresh 1.5.0 install → no update prompt (installed == latest)
- [ ] 1.4.x build with the gate armed → optional modal, dismissible, snoozes
- [ ] 1.4.x build with `min_supported_version = '1.5.0'` → fullscreen, no swipe
      dismiss, Android back does nothing, no "Not now" button
- [ ] Airplane mode on launch → **no** prompt, no error, app behaves normally
      (the gate fails open — see `app-version.service.ts`)
- [ ] Update button opens the App Store **app**, not Safari
- [ ] Revert `min_supported_version` to `0.0.0` when done testing
