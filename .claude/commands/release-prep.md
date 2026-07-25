---
description: Flag a version as done → generate App Store + Google Play copy, finalize CHANGELOG, and update the marketing site
argument-hint: "[version]  e.g. 1.3.0 (defaults to app.json version)"
---

You are preparing a release of **Ambagan** for the stores. Produce ready-to-paste
store copy, finalize the changelog, and update the marketing website — so the user
can ship without hand-writing anything.

## 0. Inputs

- Target version: `$ARGUMENTS` if given, else the `version` in `app.json`.
- Also read from `app.json`: `expo.ios.buildNumber` and `expo.android.versionCode` (report them).
- Release date: today's date (YYYY-MM-DD) from the environment.

## 1. Gather what changed (do NOT invent features — only ship what actually shipped)

1. Read the `[Unreleased]` section of `CHANGELOG.md` — this is the **primary, curated,
   user-facing source**. Keep-a-Changelog groups: Added / Changed / Fixed.
2. Cross-check with git for anything the changelog missed:
   - `git log --oneline <previous-version-bump-commit>..HEAD` (no tags exist — find the prior
     release by the last commit that changed `"version"` in `app.json`, e.g.
     `git log -p --follow -- app.json | grep -n '"version"'`).
   - Fold genuinely user-facing commits into the right bucket; ignore chores/refactors/tests.
3. If the `[Unreleased]` header is stale or mislabeled (wrong version tag), reconcile it to the
   target version using the git history. Flag any discrepancy to the user rather than guessing.

## 2. Write the copy-paste deliverable: `release-notes/v<version>.md`

Create the `release-notes/` folder if needed. The file has clearly labeled, ready-to-paste
blocks. **After each field, print its character count and the limit** (e.g. `(212 / 4000)`).
Hard-fail (rewrite shorter) anything over limit — especially Google Play "What's new" (500).

Store copy is **plain text** — stores do NOT render Markdown. Use `•` or `-` for bullets, blank
lines between sections, no `#`/`**`. Tone: warm, benefit-led, Filipino "barkada" framing —
match `MARKETING.md`. Lead with what the user gets, not internal mechanics.

Generate every field below. Fields marked *(stable)* rarely change release-to-release — generate
them, but note "update in the store only if changed from the current listing."

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
Play Console → Release → Release notes; etc.).

## 3. Finalize `CHANGELOG.md`

- Rename `## [Unreleased] — release/vX` to `## [<version>] - <date>`.
- Insert a fresh empty scaffold above it:
  ```
  ## [Unreleased]

  ### Added

  ### Changed

  ### Fixed

  ---
  ```
- Don't reword existing curated bullets beyond fixing the version label.

## 4. Update the marketing website (`docs/index.html`)

- It's a static Tailwind (CDN) page: Hero (badge + headline), Features grid (`<section id="features">`
  with cards: `<h3 class="font-semibold mb-1.5">Title</h3>` + `<p>`), Pricing, About, Contact.
- Only add/update content for **genuinely new, marketing-worthy** features in this release. Mirror
  the EXISTING card markup and Tailwind classes exactly — don't restyle. Don't duplicate features
  already listed (split, settle with proof, balances, log your way, offline, insights, scan-to-join).
- If nothing on the site needs to change, say so explicitly and touch nothing.
- Never add external assets (page is CDN-only + GitHub Pages).

## 5. Report back

Print a concise summary: version + build numbers, the files changed, any changelog/website
discrepancies you reconciled, and the copy-paste blocks (or a pointer to `release-notes/v<version>.md`).
Do NOT commit or push — leave that to the user.
