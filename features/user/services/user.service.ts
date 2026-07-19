import { User, UserPreview } from "@/types/user";
import { tables } from "@/utils/constants";
import { supabase } from "@/utils/supabase";
import { isTestEmail, shouldHideTestEmails } from "@/utils/testEmails";
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
    .select(
      "id, created_at, first_name, last_name, email, phone, avatar, plan, is_placeholder"
    )
    // Exclude placeholder (phone-contact) users — they're never added via
    // search, only through the contact picker, which de-dupes them by phone.
    .eq("is_placeholder", false)
    .or(
      `first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`
    )
    .limit(10);

  if (error) throw error;

  const users = data as UserPreview[];

  // Keep seed/QA accounts (mailinator, test.com, disposable inboxes, …) out of
  // search on production so real users never add them by accident. They stay
  // visible in dev builds so the team can still use them.
  if (shouldHideTestEmails()) {
    return users.filter((u) => !isTestEmail(u.email));
  }

  return users;
};

/**
 * Resolve a phone contact to a member id: returns an existing user's id if one
 * already has this phone, otherwise creates (or reuses) a placeholder ghost.
 * `phone` must be normalized to E.164 (see utils/phone.ts).
 */
export const createOrGetPlaceholder = async (
  phone: string,
  firstName: string,
  lastName: string
): Promise<string> => {
  const { data, error } = await supabase.rpc("create_or_get_placeholder", {
    _phone: phone,
    _first_name: firstName,
    _last_name: lastName
  });
  if (error) throw error;
  return data as string;
};

/**
 * Called right after a user finishes onboarding with a phone number: if a
 * placeholder ghost exists for that phone, its memberships and balances are
 * migrated onto this account and the ghost is removed. Returns true if claimed.
 * `phone` must be normalized to E.164.
 */
export const claimPlaceholder = async (phone: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc("claim_placeholder", {
    _phone: phone
  });
  if (error) throw error;
  return (data as number) > 0;
};

export const updateUser = async ({
  first_name,
  last_name,
  avatar
}: {
  first_name: string;
  last_name: string;
  avatar?: ImagePickerSuccessResult | null;
}) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  let avatarUrl: string | undefined;

  if (avatar) {
    const uploadResponse = await uploadFile(avatar.assets[0], "avatars");
    if (uploadResponse.error) throw uploadResponse.error;
    avatarUrl = uploadResponse.data?.publicUrl || undefined;
  }

  const updateData: Record<string, string> = { first_name, last_name };
  if (avatarUrl) updateData.avatar = avatarUrl;

  const { error, data } = await supabase
    .from(tables.USERS_TBL)
    .update(updateData)
    .eq("id", user.data.user.id)
    .select("*")
    .single();

  if (error) throw error;

  return {
    message: "User updated successfully",
    data: data as User
  };
};

export const updatePhone = async (phone: string) => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { error, data } = await supabase
    .from(tables.USERS_TBL)
    .update({ phone })
    .eq("id", user.data.user.id)
    .select("*")
    .single();

  if (error) throw error;
  return { message: "Phone updated successfully", data: data as User };
};

export const updateAvatar = async (avatar: ImagePickerSuccessResult) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const uploadResponse = await uploadFile(avatar.assets[0], "avatars");
  if (uploadResponse.error) throw uploadResponse.error;

  const avatarUrl = uploadResponse.data?.publicUrl;

  const { error, data } = await supabase
    .from(tables.USERS_TBL)
    .update({ avatar: avatarUrl })
    .eq("id", user.data.user.id)
    .select("*")
    .single();

  if (error) throw error;

  return {
    message: "Avatar updated successfully",
    data: data as User
  };
};

export const updatePassword = async ({
  currentPassword,
  newPassword
}: {
  currentPassword: string;
  newPassword: string;
}) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user?.email) {
    throw new Error("User not authenticated");
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.data.user.email,
    password: currentPassword
  });

  if (signInError) {
    throw new Error("Current password is incorrect");
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;

  return { message: "Password updated successfully" };
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
