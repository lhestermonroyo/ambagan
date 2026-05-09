import { tables } from "@/utils/constants";
import { supabase } from "@/utils/supabase";

export const registerPushToken = async (userId: string, token: string): Promise<void> => {
  const { data: existing } = await supabase
    .from(tables.USER_PUSH_TOKENS_TBL)
    .select("id")
    .eq("user_id", userId)
    .eq("token", token)
    .maybeSingle();

  if (existing) return;

  const { error } = await supabase
    .from(tables.USER_PUSH_TOKENS_TBL)
    .insert({ user_id: userId, token });

  if (error) throw error;
};

export const removePushToken = async (token: string): Promise<void> => {
  const { error } = await supabase
    .from(tables.USER_PUSH_TOKENS_TBL)
    .delete()
    .eq("token", token);

  if (error) throw error;
};
