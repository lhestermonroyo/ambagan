# Ambagan — Constants

> Single source of truth for the app's public-facing values: store links, contact
> details, pricing, and identifiers. **When generating any content that includes these
> values (release notes, marketing copy, the website, store listings), pull from here
> instead of retyping them.** Update this file when a value changes, and everything
> downstream stays consistent.

Pricing and feature descriptions verified against the codebase: **2026-10-17**.

## App identity

| Key | Value |
| --- | --- |
| App name | Ambagan |
| Full / store name | Ambagan PH |
| Meaning | Filipino: *to chip in* |
| Tagline | Split bills, settle up, no awkward math. |
| Secondary tagline (v1.4+) | Split with your barkada, or track your own. |
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

Free plan, a **one-time Pro pass**, and **Pro subscriptions** (via RevenueCat,
entitlement `Ambagan Pro` for subscriptions).

| Plan | Price |
| --- | --- |
| Free | ₱0 — up to **5 group expenses per day** (counted across all groups; resets at midnight) **plus a separate 5/day allowance for individual expenses**. Creating Groups and private Individual entries is free, with no entry-count limit. |
| Pro — 2 Weeks | **₱99** — one-time 14-day pass; does not auto-renew |
| Pro — Monthly | **₱149** |
| Pro — Yearly | **₱799** |

**Pro unlocks:** unlimited daily group and individual expenses · draft expenses ·
recurring expenses in Groups and Individual entries · CSV settlement export ·
Spending Analytics · multi-currency Groups, Individual entries, and expenses ·
separate reporting and default expense currencies per entry.

**Free for everyone:** shared Groups, private Individual entries, linked spending
totals, receipt scanning, basic stats, settlement tracking, and push notifications.
Groups and Individual entries share the Groups tab; Individual entries have Paid
and Pending tracking. The Overview offers Net Balance and Individual Totals.

> Source of truth in code: `app/profile/subscription/index.tsx` (prices) and
> `features/user/services/purchase.service.ts` (entitlement `Ambagan Pro`).

## App Store listing (stable metadata)

Full generated store copy lives per release in
`documentation/versions/vX.X/release-notes.md`. Stable fields (subtitle, keywords,
descriptions) rarely change release-to-release.
