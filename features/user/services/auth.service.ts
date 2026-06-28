import { tables } from "@/utils/constants";
import { supabase } from "@/utils/supabase";

export const isPhoneNumber = (input: string): boolean =>
  /^\+?[\d\s\-()]{7,15}$/.test(input.trim());

// Normalizes any PH phone input to the 10-digit local format stored in the DB (e.g. "9171234567")
export const normalizePhoneNumber = (input: string): string => {
  const digits = input.replace(/[\s\-()]/g, "").replace(/^\+/, "");
  if (digits.startsWith("63")) return digits.slice(2);
  if (digits.startsWith("0")) return digits.slice(1);
  return digits;
};

export const getEmailByPhone = async (phone: string): Promise<string | null> => {
  const normalized = normalizePhoneNumber(phone.trim());
  const { data } = await supabase
    .from(tables.USERS_TBL)
    .select("email")
    .eq("phone", normalized)
    .maybeSingle();
  return data?.email ?? null;
};

export const signUp = async ({
  email,
  password
}: {
  email: string;
  password: string;
}) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        email
      }
    }
  });

  if (error) throw error;
  return data;
};

export const loginWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  return data;
};

export const logout = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "ambagan://reset-password"
  });
  if (error) throw error;
};

export const setNewPassword = async (newPassword: string) => {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
};

export const deleteAccount = async () => {
  const { error } = await supabase.rpc("delete_user");
  if (error) throw error;
};
