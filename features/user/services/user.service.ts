import { User } from "@/types/user";
import { tables } from "@/utils/constants";
import { supabase } from "@/utils/supabase";

export const saveUser = async ({
  id,
  email,
  first_name,
  last_name
}: Pick<User, "id" | "email" | "first_name" | "last_name">) => {
  const { error, data } = await supabase.from(tables.USERS_TBL).insert([
    {
      id,
      email,
      first_name,
      last_name
    }
  ]);

  if (error) throw error;
  return {
    message: "User saved successfully",
    data
  };
};

export const searchUsers = async (query: string) => {
  const { data, error } = await supabase
    .from(tables.USERS_TBL)
    .select("id, created_at, first_name, last_name, email, phone, avatar")
    .or(
      `first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`
    )
    .limit(10);

  if (error) throw error;
  return data;
};

export const getUserById = async (id: string) => {
  const { data, error } = await supabase
    .from(tables.USERS_TBL)
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
};
