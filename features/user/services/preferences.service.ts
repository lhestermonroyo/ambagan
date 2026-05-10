import { UserPreferences } from "@/types/user";
import { tables } from "@/utils/constants";
import { supabase } from "@/utils/supabase";

export const getPreferences = async (userId: string): Promise<UserPreferences | null> => {
  const { data, error } = await supabase
    .from(tables.USER_PREFERENCES_TBL)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data as UserPreferences | null;
};

export const createPreferences = async (
  userId: string,
  prefs: Omit<UserPreferences, "id" | "user_id" | "updated_at">
): Promise<UserPreferences> => {
  const { data, error } = await supabase
    .from(tables.USER_PREFERENCES_TBL)
    .insert({ user_id: userId, ...prefs })
    .select("*")
    .single();

  if (error) throw error;
  return data as UserPreferences;
};

export const updatePreferences = async (
  userId: string,
  prefs: Partial<Omit<UserPreferences, "id" | "user_id" | "updated_at">>
): Promise<UserPreferences> => {
  const { data, error } = await supabase
    .from(tables.USER_PREFERENCES_TBL)
    .update({ ...prefs, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw error;
  return data as UserPreferences;
};
