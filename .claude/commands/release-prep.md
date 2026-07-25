---
description: Flag a version as done → generate App Store + Google Play copy, finalize the changelog, refresh marketing, and update the marketing site
argument-hint: "[version]  e.g. 1.3.0 (defaults to app.json version)"
---

You are preparing a release of **Ambagan** for the stores. Produce ready-to-paste store
copy, finalize the changelog, write the release's marketing content, and update the
marketing website — so the user can ship without hand-writing anything.

All docs live under **`documentation/`**:

```
documentation/
  CONSTANTS.md              ← single source of truth for URLs, email, pricing (READ THIS)
  GUIDE.md
  versions/
    v<MAJOR>.<MINOR>/       ← one folder per minor line (e.g. v1.3)
      CHANGELOG.md          ← that minor line's releases + the running [Unreleased]
      release-notes.md      ← generated copy-paste store copy
      REGRESSION_CHECKLIST.md
  marketing/
    v<version>.md           ← per-release marketing content
```

The published website lives separately in **`docs/`** (GitHub Pages: `docs/index.html`,
`docs/privacy-policy.html`) — that folder is NOT the documentation folder.

## 0. Inputs

- Target version: `$ARGUMENTS` if given, else the `version` in `app.json`.
- Also read from `app.json`: `expo.ios.buildNumber` and `expo.android.versionCode` if present (report them).
- Release date: today's date (YYYY-MM-DD) from the environment.
- **Read `documentation/CONSTANTS.md`** — pull every URL, the support email, and the pricing
  from there. Never retype these values from memory; if the copy needs one, quote CONSTANTS.
- Derive the **minor folder**: `v<MAJOR>.<MINOR>` (e.g. version `1.3.1` → folder `v1.3`).

## 1. Gather what changed (do NOT invent features — only ship what actually shipped)

1. Find the **active `[Unreleased]` section** — it lives at the top of the newest existing
   `documentation/versions/v*/CHANGELOG.md` (search for the file that contains `## [Unreleased]`).
   This is the **primary, curated, user-facing source**. Keep-a-Changelog groups: Added / Changed / Fixed.
2. Cross-check with git for anything the changelog missed:
   - `git log --oneline <previous-version-bump-commit>..HEAD` (no tags exist — find the prior
     release by the last commit that changed `"version"` in `app.json`, e.g.
     `git log -p --follow -- app.json | grep -n '"version"'`).
   - Fold genuinely user-facing commits into the right bucket; ignore chores/refactors/tests.
3. If the `[Unreleased]` content is empty or looks stale, reconcile against git history and flag
   any discrepancy to the user rather than guessing.

## 2. Write the store copy: `documentation/versions/v<MAJOR>.<MINOR>/release-notes.md`

Create the minor folder if needed. The file has clearly labeled, ready-to-paste blocks.
**After each field, print its character count and the limit** (e.g. `(212 / 4000)`).
Hard-fail (rewrite shorter) anything over limit — especially Google Play "What's new" (500).

Store copy is **plain text** — stores do NOT render Markdown. Use `•` or `-` for bullets, blank
lines between sections, no `#`/`**`. Tone: warm, benefit-led, Filipino "barkada" framing — match
the voice of prior files in `documentation/marketing/`. Lead with what the user gets, not internal
mechanics. Any URL/email/price comes from `CONSTANTS.md`.

### App Store (App Store Connect)
- **What's New in This Version** — release notes, ≤ 4000. Benefit-led bullets of this release.
- **Promotional Text** — ≤ 170. One punchy line about the newest highlight (updatable without review).
- **Subtitle** *(stable)* — ≤ 30.
- **Keywords** *(stable)* — ≤ 100, comma-separated, NO spaces after commas (wastes chars), no
  repeats of words already in the app name/subtitle.
- **Description** *(stable)* — ≤ 4000.

### Google Play (Play Console)
- **What's new** — release notes, ≤ 500. A tighter version of the App Store notes.
- **Short description** *(stable)* — ≤ 80.
- **Full description** *(stable)* — ≤ 4000.

### Paste cheat-sheet
End the file with a short "where each field goes" map (App Store Connect → Version → What's New;
Play Console → Release → Release notes; etc.). Fields marked *(stable)* rarely change — note
"update in the store only if changed from the current listing."

## 3. Finalize the changelog

Target minor folder = `documentation/versions/v<MAJOR>.<MINOR>/`.

**Case A — same minor as the active `[Unreleased]`** (e.g. releasing 1.3.1 while `[Unreleased]`
is in `v1.3/CHANGELOG.md`): finalize in place —
- Rename `## [Unreleased]` → `## [<version>] - <date>`.
- Insert a fresh empty scaffold above it:
  ```
  ## [Unreleased]

  ### Added

  ### Changed

  ### Fixed

  ---
  ```

**Case B — new minor line** (target folder doesn't exist yet, e.g. releasing 1.4.0 while
`[Unreleased]` still sits in `v1.3/CHANGELOG.md`):
- Create `documentation/versions/v<MAJOR>.<MINOR>/CHANGELOG.md` with the standard header
  (`# Changelog — v<MAJOR>.<MINOR>.x` + the Keep-a-Changelog note).
- Move the accumulated `[Unreleased]` content into the NEW file as `## [<version>] - <date>`,
  with a fresh `## [Unreleased]` scaffold above it.
- Reset the old file's `[Unreleased]` to the empty scaffold (or remove it) so only one active
  `[Unreleased]` exists.
- Seed the new folder's `REGRESSION_CHECKLIST.md` by copying the previous minor's checklist
  forward (reset all `[x]`/`[!]` back to `[ ]`, bump the "current: vX.X" header) so the user has
  a starting point. Mention this to the user.

Don't reword existing curated bullets beyond fixing the version label.

## 4. Write the release marketing: `documentation/marketing/v<version>.md`

Create a short marketing piece for this release (e.g. a launch/update social post + a one-liner),
matching the voice of existing files in `documentation/marketing/`. Lead with the human story and
the single biggest new thing this release. Pull all links/prices/email from `CONSTANTS.md`. Keep it
tight — this is copy the user can post, not a spec. If the release has nothing marketing-worthy
(pure fixes), say so and write a minimal "maintenance update" note instead of inventing hype.

## 5. Update the marketing website (`docs/index.html`)

- It's a static Tailwind (CDN) page: Hero (badge + headline), Features grid (`<section id="features">`
  with cards: `<h3 class="font-semibold mb-1.5">Title</h3>` + `<p>`), Pricing, About, Contact.
- Only add/update content for **genuinely new, marketing-worthy** features in this release. Mirror
  the EXISTING card markup and Tailwind classes exactly — don't restyle. Don't duplicate features
  already listed (split, settle with proof, balances, log your way, offline, insights, scan-to-join).
- Any URL/email/price shown on the page must match `CONSTANTS.md` — if the site drifts from
  CONSTANTS, fix the site.
- If nothing on the site needs to change, say so explicitly and touch nothing.
- Never add external assets (page is CDN-only + GitHub Pages).

## 6. Report back

Print a concise summary: version + build numbers, every file created/changed (release-notes,
changelog, marketing, website), any changelog/website discrepancies you reconciled, whether a new
minor folder + regression checklist were seeded, and the copy-paste blocks (or a pointer to
`documentation/versions/v<MAJOR>.<MINOR>/release-notes.md`). Do NOT commit or push — leave that to
the user.
