import { Session } from "@supabase/supabase-js";

export type AppearanceMode = "light" | "dark" | "system";

export type UserState = {
  session: Session | null;
  details: User | null;
  loading: boolean;
  appearanceMode: AppearanceMode;
  notificationsEnabled: boolean;
  defaultCurrency: string;
  signOut: () => Promise<void>;
  setAppearanceMode: (mode: AppearanceMode) => Promise<void>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  setDefaultCurrency: (userId: string, currency: string) => Promise<void>;
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
