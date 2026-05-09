import { Session } from "@supabase/supabase-js";

export type AppearanceMode = "light" | "dark" | "system";

export type UserPreferences = {
  id: string;
  user_id: string;
  default_currency: string;
  appearance: AppearanceMode;
  notif_settlement_request: boolean;
  notif_settlement_approved: boolean;
  notif_settlement_rejected: boolean;
  notif_settlement_completed: boolean;
  notif_expense_inclusion: boolean;
  notif_group_join: boolean;
  notif_group_leave: boolean;
  updated_at: string;
};

export type UserState = {
  session: Session | null;
  details: User | null;
  preferences: UserPreferences | null;
  loading: boolean;
  appearanceMode: AppearanceMode;
  notificationsEnabled: boolean;
  defaultCurrency: string;
  signOut: () => Promise<void>;
  setAppearanceMode: (mode: AppearanceMode) => Promise<void>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  setDefaultCurrency: (userId: string, currency: string) => Promise<void>;
  updatePreferences: (prefs: Partial<Omit<UserPreferences, "id" | "user_id" | "updated_at">>) => Promise<void>;
  loadPreferences: (userId?: string) => Promise<void>;
};

export type User = {
  id: string;
  created_at: string;
  email: string;
  phone: string | null;
  first_name: string;
  last_name: string;
  avatar: string | null;
  archived: boolean;
};

export type UserPreview = Pick<
  User,
  "id" | "email" | "phone" | "first_name" | "last_name" | "avatar"
>;
