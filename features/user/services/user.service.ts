import { User, UserPreview } from "@/types/user";
import { tables } from "@/utils/constants";
import { supabase } from "@/utils/supabase";
import { uploadFile } from "@/utils/upload";
import { ImagePickerSuccessResult } from "expo-image-picker";

export const saveUser = async ({
  first_name,
  last_name,
  phone,
  avatar
}: {
  first_name: string;
  last_name: string;
  phone: string;
  avatar: ImagePickerSuccessResult | null;
}) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  let avatarUrl: string | null = null;

  if (avatar) {
    const uploadResponse = await uploadFile(avatar.assets[0], "avatars");

    if (uploadResponse.error) throw uploadResponse.error;

    avatarUrl = uploadResponse.data?.publicUrl || null;
  }

  const { error, data } = await supabase
    .from(tables.USERS_TBL)
    .insert([
      {
        id: user.data.user.id,
        email: user.data.user.email,
        phone,
        first_name,
        last_name,
        avatar: avatarUrl
      }
    ])
    .select("*")
    .single();

  if (error) throw error;

  return {
    message: "User saved successfully",
    data: data as User
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
  return data as UserPreview[];
};

export const getUserById = async (id: string) => {
  const { data, error } = await supabase
    .from(tables.USERS_TBL)
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return {
        message: "User not found",
        data: null
      } as { message: string; data: null };
    }

    throw error;
  }

  return {
    message: "User fetched successfully",
    data: data as User
  };
};
