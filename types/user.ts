import { Session } from "@supabase/supabase-js";

export type UserState = {
  loggingOut: boolean;
  session: Session | null;
  details: User | null;
};

export type User = {
  id: string;
  created_at: string;
  email: string;
  phone: string | null;
  first_name: string;
  last_name: string;
  avatar: string | null;
};

export type UserPreview = Pick<
  User,
  "id" | "email" | "first_name" | "last_name" | "avatar"
>;
