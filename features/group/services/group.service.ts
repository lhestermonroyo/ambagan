import { tables } from "@/utils/constants";
import { supabase } from "@/utils/supabase";
import { uploadFile } from "@/utils/upload";
import { ImagePickerSuccessResult } from "expo-image-picker";
import "react-native-get-random-values";
import { v4 as uuid } from "uuid";

export const saveGroup = async ({
  name,
  category,
  avatar,
  members
}: {
  name: string;
  category: string;
  avatar: ImagePickerSuccessResult | null;
  members: string[];
}) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const groupId = uuid();
  const creator = user.data.user.id;
  let avatarUrl: string | null = null;

  if (avatar) {
    const uploadResponse = await uploadFile(avatar.assets[0], "avatars");

    if (uploadResponse.error) throw uploadResponse.error;

    avatarUrl = uploadResponse.data?.publicUrl || null;
  }

  const groupResponse = await supabase.from(tables.GROUPS_TBL).insert([
    {
      id: groupId,
      creator,
      name,
      category,
      avatar: avatarUrl
    }
  ]);

  if (groupResponse.error) {
    throw groupResponse.error;
  }

  const responses = await Promise.all([
    ...members.map((userId) => {
      return supabase.from(tables.GROUP_MEMBERS_TBL).insert([
        {
          group_id: groupId,
          user_id: userId
        }
      ]);
    })
  ]);

  for (const response of responses) {
    if (response.error) {
      throw response.error;
    }
  }

  return {
    message: "Group created successfully",
    data: {
      groupId
    }
  };
};

export const updateGroup = async (
  groupId: string,
  payload: {
    name: string;
    category: string;
    avatar: ImagePickerSuccessResult | null;
  }
) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const { name, category, avatar } = payload;

  let avatarUrl: string | null = null;

  if (avatar) {
    const uploadResponse = await uploadFile(avatar.assets[0], "avatars");

    if (uploadResponse.error) throw uploadResponse.error;

    avatarUrl = uploadResponse.data?.publicUrl || null;
  }

  const updateData: Record<string, any> = {
    name,
    category
  };

  if (avatarUrl) {
    updateData.avatar = avatarUrl;
  }

  const groupResponse = await supabase
    .from(tables.GROUPS_TBL)
    .update(updateData)
    .eq("id", groupId);

  if (groupResponse.error) {
    throw groupResponse.error;
  }

  return {
    message: "Group updated successfully"
  };
};

export const getGroupsByUserId = async (userId: string) => {
  const { data, error } = await supabase
    .from(tables.GROUP_MEMBERS_TBL)
    .select(
      `${tables.GROUPS_TBL} (
        id,
        created_at,
        category,
        name,
        avatar
      )`
    )
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  const groups = (data as any[])
    .map((item) => item[tables.GROUPS_TBL])
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  const groupIds = groups.map((g: any) => g.id);

  let membersCount: Record<string, number> = {};
  if (groupIds.length > 0) {
    const { data: membersData, error: membersError } = await supabase
      .from(tables.GROUP_MEMBERS_TBL)
      .select("group_id, user_id");

    if (membersError) {
      throw membersError;
    }

    membersCount = groupIds.reduce(
      (acc: Record<string, number>, groupId: string) => {
        acc[groupId] = membersData.filter(
          (m: any) => m.group_id === groupId
        ).length;
        return acc;
      },
      {}
    );
  }

  return groups.map((group: any) => ({
    ...group,
    members_count: membersCount[group.id] || 0
  }));
};

export const getGroupById = async (groupId: string) => {
  const [{ data, error: groupError }, { count, error: memberCountError }] =
    await Promise.all([
      supabase
        .from(tables.GROUPS_TBL)
        .select(
          `*, ${tables.USERS_TBL} (id, email, first_name, last_name, avatar)`
        )
        .eq("id", groupId)
        .single(),
      supabase
        .from(tables.GROUP_MEMBERS_TBL)
        .select("user_id", { count: "exact" })
        .eq("group_id", groupId)
    ]);

  if (groupError) {
    throw groupError;
  }

  if (memberCountError) {
    throw memberCountError;
  }

  return {
    ...(data as any),
    creator: data[tables.USERS_TBL as any],
    members_count: count || 0
  };
};
