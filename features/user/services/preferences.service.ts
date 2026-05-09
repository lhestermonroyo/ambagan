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

export const upsertPreferences = async (
  userId: string,
  prefs: Partial<Omit<UserPreferences, "id" | "user_id" | "updated_at">>
): Promise<UserPreferences> => {
  const { data, error } = await supabase
    .from(tables.USER_PREFERENCES_TBL)
    .upsert(
      { user_id: userId, ...prefs, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
    .select("*")
    .single();

  if (error) throw error;
  return data as UserPreferences;
};
