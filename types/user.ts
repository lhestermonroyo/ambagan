import { Session } from "@supabase/supabase-js";

export type AppearanceMode = "light" | "dark" | "system";

export type SettlementView = "full" | "compact";

export type UserPreferences = {
  id: string;
  user_id: string;
  default_currency: string;
  appearance: AppearanceMode;
  settlement_view: SettlementView;
  notif_settlement_request: boolean;
  notif_settlement_approved: boolean;
  notif_settlement_rejected: boolean;
  notif_settlement_completed: boolean;
  notif_expense_inclusion: boolean;
  notif_group_join: boolean;
  notif_group_leave: boolean;
  updated_at: string;
};

export type RouteIntent =
  | "splash"
  | "welcome"
  | "onboarding"
  | "tabs"
  | "login";

export type UserState = {
  session: Session | null;
  details: User | null;
  preferences: UserPreferences | null;
  loading: boolean;
  // Single source of truth for top-level (cold-start) routing in app/index.tsx.
  // Resolved by fetchDetails so we never flash /(tabs) before the profile/auth
  // state is known.
  routeIntent: RouteIntent;
  // Name captured from a Google/Apple sign-in, used once to pre-fill onboarding.
  // Apple only returns the name on the FIRST authorization, so we stash it here
  // the moment we get it. Cleared by onboarding after it reads the value.
  oauthName: { firstName: string; lastName: string } | null;
  appearanceMode: AppearanceMode;
  settlementView: SettlementView;
  notificationsEnabled: boolean;
  defaultCurrency: string;
  signOut: () => void;
  setAppearanceMode: (mode: AppearanceMode) => Promise<void>;
  setSettlementView: (view: SettlementView) => Promise<void>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  setDefaultCurrency: (userId: string, currency: string) => Promise<void>;
  updatePreferences: (prefs: Partial<Omit<UserPreferences, "id" | "user_id" | "updated_at">>) => Promise<void>;
  loadPreferences: (userId?: string) => Promise<void>;
};

export type UserPlan = "free" | "pro";

export type User = {
  id: string;
  created_at: string;
  email: string;
  phone: string | null;
  first_name: string;
  last_name: string;
  avatar: string | null;
  archived: boolean;
  plan: UserPlan;
  plan_expires_at: string | null;
  // True for a phone-contact member who has no Ambagan account yet (a
  // placeholder that gets claimed when they sign up with the same phone).
  is_placeholder?: boolean;
};

export type UserPreview = Pick<
  User,
  | "id"
  | "email"
  | "phone"
  | "first_name"
  | "last_name"
  | "avatar"
  | "plan"
  | "is_placeholder"
>;
