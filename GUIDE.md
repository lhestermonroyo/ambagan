# Ambagan — App Guide

## Table of Contents
1. [App Overview](#1-app-overview)
2. [Features](#2-features)
3. [Tech Stack](#3-tech-stack)
4. [Project Structure](#4-project-structure)
5. [Architecture Breakdown](#5-architecture-breakdown)
6. [Environment Variables](#6-environment-variables)
7. [Local Development Setup](#7-local-development-setup)
8. [Building & Deploying](#8-building--deploying)
9. [App Store Connect Setup](#9-app-store-connect-setup)
10. [RevenueCat Setup](#10-revenuecat-setup)
11. [Push Notifications Setup](#11-push-notifications-setup)
12. [Testing Environments](#12-testing-environments)
13. [Known Issues & Fixes](#13-known-issues--fixes)

---

## 1. App Overview

**Name:** Ambagan  
**Tagline:** Split smarter. Settle faster.  
**Platform:** iOS (primary), Android  
**Bundle ID (iOS):** `com.lhestermonroyo.ambagan`  
**Package (Android):** `com.lhestermonroyo.ambagan`  
**Version:** 1.0.0 (Build 1)  
**EAS Project ID:** `39236d20-59ff-4cad-ba80-20348dda7e2c`  
**EAS Owner:** `lhestermonroyo.dev`  
**Support Email:** lhester.monroyo.dev@gmail.com  

Ambagan is a Filipino group expense splitting app. Members of a group can log shared expenses, track who paid what, and settle balances with each other. Free users can create up to 3 groups. Pro users unlock unlimited groups, multi-currency support, CSV exports, and more.

---

## 2. Features

### Free Plan
- Create up to 3 groups
- Add and split expenses equally or by custom amount
- Track balances per group
- Request and approve settlements
- Push notifications
- Friends list
- Quick-add expense from home screen

### Pro Plan (₱99/mo or ₱799/yr)
- Unlimited groups
- 14 supported currencies with per-expense currency selection
- CSV export of expenses
- Offline access (cached group data via SQLite)
- Priority support

### Expense Splitting
- Custom expense form: choose payers, split amounts, attach receipt photo
- Quick-add: fast single-payer equal-split from home
- Equal split and custom split modes
- Settlement request flow: request → approve/reject → mark complete
- Proof of payment upload for settlement requests

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK 54, React Native 0.81 |
| Navigation | Expo Router 6 (file-based) |
| UI Components | Gluestack UI v3, NativeWind (Tailwind) |
| State Management | Zustand v5 |
| Backend / DB | Supabase (Postgres, Auth, Storage, Realtime) |
| In-App Purchases | RevenueCat (`react-native-purchases` v10) |
| Push Notifications | Expo Notifications + Supabase Realtime |
| Offline Storage | expo-sqlite |
| Image Handling | expo-image (caching), expo-image-manipulator (compression) |
| Animations | react-native-reanimated v4, @legendapp/motion |
| Build & Deploy | EAS Build + EAS Submit |

---

## 4. Project Structure

```
ambagan-ph/
├── app/                        # Expo Router screens
│   ├── _layout.tsx             # Root layout — auth listener, push setup
│   ├── index.tsx               # Entry redirect (auth check)
│   ├── (auth)/                 # Unauthenticated screens
│   │   ├── welcome.tsx
│   │   ├── login.tsx
│   │   ├── sign-up.tsx
│   │   ├── onboarding.tsx
│   │   ├── forgot-password.tsx
│   │   └── reset-password.tsx
│   ├── (tabs)/                 # Main tab screens
│   │   ├── index.tsx           # Home
│   │   ├── groups.tsx          # Groups list
│   │   ├── friends.tsx         # Friends
│   │   └── profile.tsx         # Profile
│   ├── groups/
│   │   ├── create/             # Create group form
│   │   └── [groupId]/
│   │       ├── index.tsx       # Group details
│   │       ├── edit/           # Edit group
│   │       ├── new-expense/    # Add expense form
│   │       └── [expenseId]/    # Expense details
│   ├── friends/[friendId]/     # Friend profile
│   ├── notifications/          # Notifications list
│   └── profile/
│       ├── personal-info/
│       ├── account-settings/
│       ├── subscription/
│       ├── help-center/
│       └── about/
│
├── features/                   # Feature-scoped logic
│   ├── user/
│   │   ├── components/
│   │   ├── services/           # auth, user, purchase, push-token, preferences
│   │   └── states/             # user.state.ts
│   ├── group/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/           # group, member
│   │   └── states/             # group.state.ts
│   ├── expense/
│   │   ├── components/
│   │   ├── services/           # expense
│   │   ├── states/             # expense.state.ts
│   │   └── utils/
│   ├── friends/
│   │   ├── components/
│   │   └── services/           # friend
│   ├── notifications/
│   │   ├── components/
│   │   ├── services/           # notification
│   │   └── states/             # notification.state.ts
│   └── profile/
│       └── components/         # EditNameSheet, EditPhoneSheet, AppearanceSheet, etc.
│
├── components/                 # Shared UI components
│   └── ui/                     # Gluestack primitives
├── states/                     # Zustand store barrel export
├── services/                   # Services barrel export
├── utils/                      # Helpers (supabase, upload, formatPhone, etc.)
├── layouts/                    # Screen layout wrappers (TabLayout, InnerLayout, etc.)
├── hooks/                      # Custom hooks (use-app-toast, etc.)
├── types/                      # TypeScript types
├── assets/                     # Fonts, images, icons
├── app.json                    # Expo config
├── eas.json                    # EAS Build profiles
└── .env                        # Environment variables (not committed)
```

---

## 5. Architecture Breakdown

### Navigation
Expo Router uses file-based routing. The root `_layout.tsx` handles:
- Supabase auth session on mount
- `onAuthStateChange` — redirects to onboarding/login on session expiry, removes push token
- Push notification listeners (foreground received + tap response)
- Appearance mode flash overlay animation

### State (Zustand)
Each feature has its own Zustand slice, combined in `/states/index.ts`:

| Store | Key State |
|---|---|
| `states.user` | `session`, `details`, `preferences`, `appearanceMode`, `defaultCurrency` |
| `states.group` | `list`, `details`, `memberList`, `expenseList`, `settlementList` |
| `states.expense` | `details`, `payerList`, `memberSplitList`, `paymentSplitList` |
| `states.notification` | `list`, `unreadCount` |

### Services
All services are Supabase calls, exported from `/services/index.ts`:

| Service | Responsibility |
|---|---|
| `auth` | Login, sign-up, logout, reset password, phone lookup |
| `user` | Save/update user, avatar, phone, password |
| `preferences` | Load/update notification preferences, appearance, currency |
| `purchase` | RevenueCat init, sync plan to Supabase |
| `pushToken` | Register/remove device push tokens |
| `group` | CRUD groups, archive, paginated list |
| `member` | Fetch/manage group members |
| `expense` | CRUD expenses, payers, splits, payments |
| `friend` | Add/remove friends, recent users |
| `notification` | Create, fetch, mark read, get route by type |

### Database (Supabase)
Key tables:
- `users_tbl` — user profile, plan, phone, avatar
- `groups_tbl` — group name, category, avatar, admin, archived
- `group_members_tbl` — group ↔ member mapping
- `expenses_tbl` — expense details, amount, currency, receipt
- `expense_payers_tbl` — who paid and how much
- `expense_member_splits_tbl` — how much each member owes
- `expense_payment_splits_tbl` — settlement records between members
- `user_push_tokens_tbl` — device tokens for push notifications
- `notifications_tbl` — in-app and push notification records
- `user_preferences_tbl` — per-user notification toggles, appearance, currency

### Image Upload
All uploads go through `utils/upload.ts` which:
1. Compresses via `expo-image-manipulator` before upload
2. Uses bucket-specific settings: avatars (256px, 0.7 quality), group covers (512px, 0.75), receipts (1024px, 0.8)
3. Stores as JPEG with 1-year cache-control
4. Images are displayed via `expo-image` with `cachePolicy="memory-disk"`

### Expense Splitting Logic
Located in `features/expense/utils/`. The `generatePaymentSplits` function uses a greedy algorithm to match payers to split members and produce the minimum set of settlement transactions. If everyone pays exactly their share, `paymentSplits` is empty — the form blocks submission with an error in this case.

---

## 6. Environment Variables

Create a `.env` file at the root (never commit this):

```env
# Supabase
EXPO_PUBLIC_SB_URL=https://<project>.supabase.co
EXPO_PUBLIC_SB_API_KEY=<anon_public_key>
EXPO_PUBLIC_SB_DB_PASSWORD=<db_password>

# OAuth (if applicable)
EXPO_OAUTH_CLIENT_ID=<client_id>
EXPO_OAUTH_CLIENT_SECRET=<client_secret>

# RevenueCat
EXPO_PUBLIC_REVENUE_CAT_API_KEY_TEST=<sandbox_key>   # Used in dev/Expo Go
EXPO_PUBLIC_REVENUE_CAT_API_KEY=<production_key>     # Used in TestFlight/live
```

The app selects the RevenueCat key based on the build environment:
```ts
const apiKey = __DEV__
  ? process.env.EXPO_PUBLIC_REVENUE_CAT_API_KEY_TEST
  : process.env.EXPO_PUBLIC_REVENUE_CAT_API_KEY;
```

`__DEV__` is `true` in Expo Go and development builds, `false` in TestFlight and production.

---

## 7. Local Development Setup

### Prerequisites
- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`
- Xcode (for iOS simulator)
- Android Studio (for Android emulator)

### Steps
```bash
# 1. Install dependencies
npm install

# 2. Create .env file and fill in values (see section 6)
cp .env.example .env

# 3. Start Expo dev server
npm start

# 4. Run on iOS simulator
npm run ios

# 5. Run on Android emulator
npm run android
```

### Build a dev client (needed for native modules like RevenueCat, notifications)
```bash
# iOS Simulator
npm run build:ios          # runs: eas build --platform ios --profile ios-simulator

# Android Emulator
npm run build:android      # runs: eas build --platform android --profile android-emulator
```

Install the resulting `.app` / `.apk` on the simulator/emulator, then `npm start` to connect.

---

## 8. Building & Deploying

### EAS Build Profiles (`eas.json`)

| Profile | Use Case | Distribution |
|---|---|---|
| `development` | Dev client with native modules | Internal |
| `ios-simulator` | Dev build for iOS simulator | Internal |
| `production` | App Store / Play Store release | Store |

### Build Commands
```bash
# Production iOS (App Store)
npm run build:ios-prod      # eas build --platform ios --profile production

# Production Android (Play Store)
npm run build:android-prod  # eas build --platform android --profile production
```

### Submit to App Store
```bash
npm run submit:ios-prod     # eas submit --platform ios --profile production --latest
```
This uses the most recent production build and submits it to App Store Connect for review.

### Version Management
`eas.json` has `"appVersionSource": "remote"` — build numbers are managed by EAS, not manually in `app.json`. The `production` profile has `"autoIncrement": true` so each build gets a new build number automatically.

---

## 9. App Store Connect Setup

### App Info
- **Name:** Ambagan
- **Bundle ID:** `com.lhestermonroyo.ambagan`
- **SKU:** `ambagan`
- **Primary Language:** English
- **Category:** Finance
- **Age Rating:** 4+
- **Content Rights:** Does not use third-party content

### Capabilities Required
When registering the App ID in Certificates, Identifiers & Profiles:
- **Push Notifications** — required for Expo push notifications
- **In-App Purchase** — required for RevenueCat subscriptions

### Certificates & Provisioning
1. Create a **Distribution Certificate** (Software) in Certificates, Identifiers & Profiles
2. Upload a **CSR** (Certificate Signing Request) generated via Keychain Access on Mac
3. Download the `.cer` file and add it to Keychain
4. EAS handles provisioning profiles automatically during `eas build`

### In-App Purchase Products
Two subscription products must be created in App Store Connect → your app → In-App Purchases:

| Product ID | Type | Price |
|---|---|---|
| `ambagan_pro_monthly` | Auto-Renewable Subscription | ₱99/month |
| `ambagan_pro_yearly` | Auto-Renewable Subscription | ₱799/year |

Both must be added to a **Subscription Group** (e.g., "Ambagan Pro") and linked to the app version under the **In-App Purchases** section of the version page. Status must be at least **Ready to Submit** before RevenueCat can load them.

### App Review Notes
```
This app allows users to split shared expenses in a group setting.
To test Pro features, use the sandbox account provided.
In-App Purchase testing uses Apple Sandbox — no real charges will occur.
The app requires an account to use. You may create a new one on the sign-up screen.
```

### Screenshots
- **Required size:** 1242 × 2688 px (iPhone 6.5" — iPhone XS Max / 11 Pro Max)
- Minimum 3 screenshots per device size
- No alpha channels or transparencies in images

---

## 10. RevenueCat Setup

### Dashboard
- URL: https://app.revenuecat.com
- App: Ambagan (iOS)

### Setup Steps

**1. Create Products**
In RevenueCat → Products, add:
- `ambagan_pro_monthly`
- `ambagan_pro_yearly`

Product IDs must exactly match App Store Connect.

**2. Create Entitlement**
- ID: `pro`
- Attach both products to this entitlement

**3. Create Offering**
- ID: `default` (RevenueCat uses this as the default offering)
- Create a package for monthly and yearly, link to respective products

**4. Link App Store Connect API Key**
In RevenueCat → App Settings → App Store Connect API:
- Generate a key in App Store Connect → Users & Access → Integrations → App Store Connect API
- Role: **Developer** or **Finance** (Finance needed for financial reports)
- Upload the `.p8` file to RevenueCat

**5. SDK Initialization**
`initializePurchases` is called in the root layout on auth state change:
```ts
Purchases.configure({ apiKey, appUserID: userId });
```
The `appUserID` ties purchases to the Supabase user ID so purchases persist across devices.

**6. Syncing Plan to Supabase**
After a successful purchase, `syncPlanToSupabase` updates `users_tbl.plan` to `"pro"` and sets `plan_expires_at`. It uses `{ count: "exact" }` to detect silent update failures (0 rows affected).

### Entitlement Check
```ts
const customerInfo = await Purchases.getCustomerInfo();
const isPro = customerInfo.entitlements.active["pro"] !== undefined;
```

---

## 11. Push Notifications Setup

Expo push notifications require:
1. **APNs Key** — generated in App Store Connect → Certificates, Identifiers & Profiles → Keys
   - Enable **Apple Push Notifications service (APNs)**
   - Upload the `.p8` key to **expo.dev** under your project's credentials
2. **`UIBackgroundModes: ["remote-notification"]`** — already set in `app.json`
3. **EAS Project ID** — set in `app.json` under `extra.eas.projectId`

### Token Lifecycle
- **Register:** on login/app load, token is stored in `user_push_tokens_tbl` (deduped — removes token from any other user first)
- **Remove:** on sign out, session expiry, or account switch
- **Realtime:** Supabase Realtime listens on `notifications_tbl` inserts for the current user

### Notification Types
| Type | Trigger |
|---|---|
| `GROUP_JOIN` | Added to a group |
| `GROUP_LEAVE` | Member left your group |
| `EXPENSE_INCLUSION` | Added to an expense |
| `SETTLEMENT_REQUEST` | Someone requests settlement from you |
| `SETTLEMENT_APPROVED` | Your request was approved |
| `SETTLEMENT_REJECTED` | Your request was rejected |
| `SETTLEMENT_COMPLETED` | Settlement marked complete |

---

## 12. Testing Environments

### Summary Table

| Feature | Expo Go / Dev Build | TestFlight | Live (App Store) |
|---|---|---|---|
| `__DEV__` flag | `true` | `false` | `false` |
| RevenueCat key used | `REVENUE_CAT_API_KEY_TEST` | `REVENUE_CAT_API_KEY` | `REVENUE_CAT_API_KEY` |
| IAP environment | Apple Sandbox | Apple Sandbox | Apple Production |
| Real charges | No | No | Yes |
| Push notifications | Works with dev client | Works | Works |
| Supabase | Same project (shared DB) | Same project | Same project |

### Testing In-App Purchases (Sandbox)

1. Create a **Sandbox Tester** account in App Store Connect → Users & Access → Sandbox Testers
   - Use a different Apple ID than your real one
2. On your physical device, **do not** sign in to the sandbox account in Settings → App Store
3. Trigger a purchase in the app — iOS will prompt for an Apple ID at that point
4. Sign in with the sandbox account **only at the purchase prompt**
5. Sandbox purchases are instant (no trial delays), and subscriptions renew every few minutes

### Testing Push Notifications
- Push notifications do **not** work in Expo Go or iOS Simulator
- Use a **development build** (`npm run build:ios`) installed on a physical device
- Or use **TestFlight** for a closer-to-production test

### Supabase Note
All environments (dev, TestFlight, production) point to the **same Supabase project** unless you set up separate projects. Be careful running destructive tests on data that production users can see.

---

## 13. Known Issues & Fixes

### expo-image-manipulator version mismatch → app crashes on startup
**Symptom:** TestFlight/production build crashes immediately with `Cannot find native module 'ExpoImageManipulator'`.  
**Cause:** Installing `expo-image-manipulator` directly via `npm install` can pull in a version built for a newer SDK (e.g. `56.x` when the project uses SDK 54).  
**Fix:** Always install Expo packages with:
```bash
npx expo install expo-image-manipulator
```
This resolves the correct version for your SDK. For SDK 54, the correct version is `~14.0.8`.  
**Rule:** Use `npx expo install <package>` for any Expo/React Native package, never `npm install` directly.

---

### EAS build not picking up environment secrets
**Symptom:** App crashes on startup in TestFlight; env vars are `undefined` in production.  
**Cause:** Local `.env` files are only read by the Expo dev server — EAS builds ignore them.  
**Fix:** Set secrets via the EAS dashboard or CLI:
```bash
eas secret:create --scope project --name EXPO_PUBLIC_SB_URL --value "your_value"
eas secret:create --scope project --name EXPO_PUBLIC_SB_API_KEY --value "your_value"
eas secret:create --scope project --name EXPO_PUBLIC_REVENUE_CAT_API_KEY --value "your_value"
eas secret:create --scope project --name EXPO_PUBLIC_REVENUE_CAT_API_KEY_TEST --value "your_value"
```
Secrets set here are automatically injected into all future builds for the project.

Optionally, explicitly link a build profile to an EAS environment in `eas.json`:
```json
"production": {
  "autoIncrement": true,
  "environment": "production"
}
```

---

### How to get crash logs for a TestFlight build
Three options:
1. **Xcode:** Connect device → Xcode → Window → Devices and Simulators → select device → View Device Logs
2. **Console app (Mac):** Open Console → connect iPhone → filter by app name → reproduce the crash
3. **App Store Connect:** Your app → TestFlight → Crashes (takes a few hours to appear)

---

### Navigation: router.back() vs router.push() vs router.replace()

Using `router.push("/some-screen")` for back navigation triggers a **forward slide animation** instead of the expected pop animation. Always use the correct method:

| Situation | Method | Reason |
|---|---|---|
| User presses back button | `router.back()` | Pops the screen with correct animation |
| After group/record creation | `router.replace("/some-screen")` | Replaces creation form in stack so back goes to the list, not the form |
| Error/guard redirect | `router.replace("/some-screen")` | Avoids leaving broken screen in the stack |
| Navigate to a new screen | `router.push("/some-screen")` | Pushes onto the stack normally |

**Example — group creation:** after `saveGroup` succeeds, use `router.replace(\`/groups/${groupId}\`)` so the creation form is swapped out. If you used `router.push`, pressing back from group details would return to the form instead of the groups list.

---

### RevenueCat entitlement ID must match exactly
The entitlement identifier in `purchase.service.ts` must exactly match the ID in the RevenueCat dashboard (case-sensitive, not the display name):
```ts
// features/user/services/purchase.service.ts
const PRO_ENTITLEMENT_ID = "pro"; // must match RevenueCat entitlement ID exactly
```
If it doesn't match, `isProEntitlementActive()` always returns `false` and Pro features never unlock even after a successful purchase.

---

### Testing RevenueCat purchases in TestFlight
TestFlight uses Apple's **Sandbox** environment — no real charges.

1. Create a **Sandbox Tester** in App Store Connect → Users & Access → Sandbox Testers
   - Use a **brand new email** that has never been registered as an Apple ID (e.g. create a fresh Gmail)
   - Do NOT use your personal Apple ID email — Apple rejects it with `active = false`
2. Go to **Settings → App Store** on your device → tap your Apple ID → **Sign Out**
3. Open TestFlight → go to the subscription screen → tap a plan
4. iOS will prompt for an Apple ID → sign in with the sandbox tester credentials there
5. Purchase completes instantly; RevenueCat dashboard shows it under the Sandbox toggle
6. Sandbox subscriptions renew every few minutes (not monthly/yearly)
7. After testing, go back to Settings → App Store and sign in with your real Apple ID

---

### RevenueCat "no App Store products registered" error (CONFIGURATION_ERROR)
**Symptom:** `getOfferings()` throws with message *"There is an issue with your configuration... there are no App Store products registered in the RevenueCat dashboard for your offerings."*  
**Error code:** `CONFIGURATION_ERROR`

**Checklist — work through these in order:**

1. **Paid Applications agreement** — App Store Connect → Agreements, Tax, and Banking → Paid Applications must be **Active** (not pending). Without this, Apple blocks all IAP products from loading in any environment including sandbox.
2. **Propagation delay** — after activating the Paid Applications agreement, Apple's sandbox takes **12–24 hours** to propagate. This is the most common cause of a persistent CONFIGURATION_ERROR immediately after setup. Wait and retry the next day.
3. **Subscriptions linked to app version** — App Store Connect → your app version → scroll to "In-App Purchases and Subscriptions" → both subscription products must be listed there.
4. **RevenueCat offering has packages** — RevenueCat → Offerings → `default` offering must have packages, and each package must be linked to a valid product (`ambagan_pro_monthly`, `ambagan_pro_yearly`).
5. **Dead products in RevenueCat** — delete any products with "Not found" status in RevenueCat → Products. They don't affect offerings directly but are clutter that can cause confusion.
6. **App-Specific Shared Secret** — deprecated in newer App Store Connect; not needed if you're using the App Store Connect API key in RevenueCat.
7. **Bundle ID in RevenueCat** — must exactly match `com.lhestermonroyo.ambagan`.

---

### W-8BEN (Tax form for Philippines-based developer)
Required in App Store Connect → Agreements, Tax, and Banking before the Paid Applications agreement can be activated.

| Field | Value |
|---|---|
| Name | Full legal name |
| Country of citizenship | Philippines |
| Permanent residence address | PH address |
| Foreign tax identifying number | Philippine TIN (BIR 12-digit) |
| Treaty country | Philippines |
| Treaty article | Article 13 (Royalties) |
| Withholding rate | 15% (reduced from 30% via US-PH treaty) |
| Type of income | Royalties |

Sign Part III and date. Without claiming the treaty benefit (Part II), Apple withholds 30% of all earnings.
