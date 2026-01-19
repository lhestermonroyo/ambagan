import { Session } from '@supabase/supabase-js';

export type AuthState = {
  authenticated: boolean;
  loggingOut: boolean;
  user: User | null;
  session: Session | null;
};

export type User = {
  id: string;
  created_at: string;
  email: string;
  phone: string | null;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
};
