# Ambagan PH

**Ambagan** (Filipino: *to chip in*) is a mobile expense-splitting app built for groups of friends, families, and colleagues. Track shared costs, split bills fairly, and settle debts — all in one place.

---

## Features

- **Groups** — Create groups for trips, households, or any shared expense. Add members, track expenses, and manage settlements per group.
- **Expenses** — Log expenses with flexible split types: equal, by percentage, or custom amount per person. Attach proof of payment images.
- **Settlements** — Request, approve, or reject settlements with real-time push notifications. Track full payment history per group and per friend.
- **Friends** — See everyone you share a group with, along with a net balance summary of what you owe or are owed.
- **Multi-currency** — Each expense supports its own currency. Useful for travel groups across different countries.
- **CSV Export** — Export settlement history per group to a CSV file for record-keeping.
- **Offline Access** — Pro users can browse their groups, expenses, and settlements without an internet connection.
- **Push Notifications** — Get notified for settlement requests, approvals, rejections, new expenses, and group activity.
- **Free & Pro Plans** — Free plan supports up to 3 active groups. Pro unlocks unlimited groups, multi-currency, CSV export, and offline access.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK 54, Expo Router v6 |
| UI | React Native 0.81, NativeWind (Tailwind CSS), GluestackUI |
| State | Zustand |
| Backend | Supabase (Auth + PostgreSQL + Storage) |
| Local DB | expo-sqlite (offline cache) |
| Icons | lucide-react-native |
| Navigation | Expo Router (file-based) |

---

## Project Structure

```
ambagan-ph/
├── app/                     # Screens via Expo Router
│   ├── (auth)/              # Login, sign-up, onboarding, forgot/reset password
│   ├── (tabs)/              # Main tabs: Overview, Groups, Friends, Profile
│   ├── groups/[groupId]/    # Group detail, expenses, members, new expense
│   ├── friends/             # Friend detail
│   ├── notifications/       # Notification list
│   └── profile/             # Personal info, subscription, settings, help center
├── components/              # Shared UI components
├── features/                # Feature modules (expense, group, friends, user, etc.)
├── hooks/                   # Custom React hooks
├── layouts/                 # Screen layout wrappers
├── services.ts              # Supabase API service aggregator
├── states.ts                # Zustand global state stores
├── types/                   # TypeScript types
└── utils/                   # Helpers (formatting, cache, Supabase client, etc.)
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Yarn](https://yarnpkg.com/)
- [Expo CLI](https://docs.expo.dev/get-started/installation/) — `npm install -g expo-cli`
- [Expo Go](https://expo.dev/go) app on your device, or a configured iOS Simulator / Android Emulator
- A [Supabase](https://supabase.com/) project with the schema applied (see below)

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/lhestermonroyo/ambagan-ph.git
cd ambagan-ph
```

### 2. Install dependencies

```bash
yarn install
```

### 3. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Run the SQL schema in `db.sql` against your Supabase database using the SQL Editor.
3. Enable **Email** authentication in your Supabase project under Authentication → Providers.
4. Create a storage bucket named `ambagan` for file uploads (avatars, proof of payment images).

### 4. Configure environment

Create a `utils/config.toml` file (or update the existing one) with your Supabase credentials:

```toml
[supabase]
url = "https://your-project.supabase.co"
anon_key = "your-anon-key"
```

> You can find your URL and anon key in your Supabase project under **Settings → API**.

### 5. Start the development server

```bash
yarn start
```

Then scan the QR code with Expo Go, or press:
- `i` — open in iOS Simulator
- `a` — open in Android Emulator

---

## Running a Development Build

For full native feature support (push notifications, camera, SQLite offline cache), a development build is recommended over Expo Go.

```bash
# iOS
yarn ios

# Android
yarn android
```

> Make sure you have Xcode (iOS) or Android Studio (Android) installed and configured.

---

## Push Notifications

Push notifications use [Expo Notifications](https://docs.expo.dev/push-notifications/overview/) via the Expo Push Service.

- The EAS project ID is configured in `app.json` under `extra.eas.projectId`.
- Notification preferences are stored per user in Supabase and can be toggled in **Profile → Push Notifications**.

---

## Linting

```bash
yarn lint
```
