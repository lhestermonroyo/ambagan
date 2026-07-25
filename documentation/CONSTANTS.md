# Ambagan — Constants

> Single source of truth for the app's public-facing values: store links, contact
> details, pricing, and identifiers. **When generating any content that includes these
> values (release notes, marketing copy, the website, store listings), pull from here
> instead of retyping them.** Update this file when a value changes, and everything
> downstream stays consistent.

Last verified against the codebase: **2026-07-25** (app version `1.3.0`).

## App identity

| Key | Value |
| --- | --- |
| App name | Ambagan |
| Full / store name | Ambagan PH |
| Meaning | Filipino: *to chip in* |
| Tagline | Split bills, settle up, no awkward math. |
| iOS bundle identifier | `com.lhestermonroyo.ambagan` |
| Android package | `com.lhestermonroyo.ambagan` |
| App Store ID | `6779220285` |

## Links

| Key | Value |
| --- | --- |
| Marketing website (canonical) | https://lhestermonroyo.github.io/ambagan/ |
| Marketing website (branded label) | ambagan.ph |
| App Store | https://apps.apple.com/ph/app/ambagan-ph/id6779220285 |
| Google Play | _Not live yet — "Android coming soon."_ |
| Privacy policy | https://lhestermonroyo.github.io/ambagan/privacy-policy.html |

> The site is served from GitHub Pages out of `docs/` (`docs/index.html`,
> `docs/privacy-policy.html`). "ambagan.ph" is the brand label; the canonical URL is the
> `github.io` one above until a custom domain is wired up.

## Contact

| Key | Value |
| --- | --- |
| Support / contact email (public, used in-app & on site) | lhester.monroyo.dev@gmail.com |

## Pricing

Free plan and a **Pro subscription** (via RevenueCat, entitlement `Ambagan Pro`).

| Plan | Price |
| --- | --- |
| Free | ₱0 — up to **5 expenses per day** (counted across all groups; resets at midnight) |
| Pro — 2 Weeks | **₱99** |
| Pro — Monthly | **₱149** |
| Pro — Yearly | **₱799** |

**Pro unlocks:** unlimited daily expenses · draft expenses · recurring expenses · CSV
export · spending analytics · multi-currency expenses · custom default currency. Push
notifications are free for everyone.

> Source of truth in code: `app/profile/subscription/index.tsx` (prices) and
> `features/user/services/purchase.service.ts` (entitlement `Ambagan Pro`).

## App Store listing (stable metadata)

Full generated store copy lives per release in
`documentation/versions/vX.X/release-notes.md`. Stable fields (subtitle, keywords,
descriptions) rarely change release-to-release.
