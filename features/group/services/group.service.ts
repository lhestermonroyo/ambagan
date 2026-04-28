import { Group, Member } from "@/types/groups";
import { tables } from "@/utils/constants";
import { supabase } from "@/utils/supabase";
import { uploadFile } from "@/utils/upload";
import { ImagePickerSuccessResult } from "expo-image-picker";
import "react-native-get-random-values";
import { v4 as uuid } from "uuid";
import { getMembersByGroupIds } from "./member.service";

export const saveGroup = async ({
  name,
  avatar,
  category,
  admin_id,
  member_ids
}: {
  name: string;
  category: string;
  avatar: ImagePickerSuccessResult | null;
  admin_id: string;
  member_ids: string[];
}) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  if (admin_id !== user.data.user.id) {
    throw new Error("Admin ID must be the same as the authenticated user");
  }

  const groupId = uuid();
  let avatarUrl: string | null = null;

  if (avatar) {
    const uploadResponse = await uploadFile(avatar.assets[0], "avatars");

    if (uploadResponse.error) throw uploadResponse.error;

    avatarUrl = uploadResponse.data?.publicUrl || null;
  }

  const groupResponse = await supabase.from(tables.GROUPS_TBL).insert([
    {
      id: groupId,
      name,
      category,
      avatar: avatarUrl,
      admin_id
    }
  ]);

  if (groupResponse.error) {
    throw groupResponse.error;
  }

  const responses = await Promise.all([
    ...member_ids.map((id) => {
      return supabase.from(tables.GROUP_MEMBERS_TBL).insert([
        {
          group_id: groupId,
          member_id: id
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

  const { data: groupData, error: groupError } = await supabase
    .from(tables.GROUPS_TBL)
    .select("admin_id")
    .eq("id", groupId)
    .single();

  if (groupError) {
    throw groupError;
  }

  if (groupData.admin_id !== user.data.user.id) {
    throw new Error("Only the group admin can update the group");
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

  const { error } = await supabase
    .from(tables.GROUPS_TBL)
    .update(updateData)
    .eq("id", groupId);

  if (error) {
    throw error;
  }

  return {
    message: "Group updated successfully"
  };
};

export const deleteGroup = async (groupId: string) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const { data: groupData, error: groupError } = await supabase
    .from(tables.GROUPS_TBL)
    .select("admin_id")
    .eq("id", groupId)
    .single();

  if (groupError) {
    throw groupError;
  }

  if (groupData.admin_id !== user.data.user.id) {
    throw new Error("Only the group admin can delete the group");
  }

  const { data: expenses, error: expensesError } = await supabase
    .from(tables.EXPENSES_TBL)
    .select("id")
    .eq("group_id", groupId);

  if (expensesError) {
    throw expensesError;
  }

  const expenseIds = expenses.map((e) => e.id);

  if (expenseIds.length > 0) {
    const { error: deleteExpensesError } = await supabase
      .from(tables.EXPENSES_TBL)
      .delete()
      .in("id", expenseIds);

    if (deleteExpensesError) {
      throw deleteExpensesError;
    }

    const { error: deleteSplitsError } = await supabase
      .from(tables.MEMBER_SPLITS_TBL)
      .delete()
      .in("expense_id", expenseIds);

    if (deleteSplitsError) {
      throw deleteSplitsError;
    }
  }

  const { error: membersError } = await supabase
    .from(tables.GROUP_MEMBERS_TBL)
    .delete()
    .eq("group_id", groupId);

  if (membersError) {
    throw membersError;
  }

  const groupResponse = await supabase
    .from(tables.GROUPS_TBL)
    .delete()
    .eq("id", groupId);

  if (groupResponse.error) {
    throw groupResponse.error;
  }

  return {
    success: true,
    message: "Group deleted successfully"
  };
};

export const getGroupsByUserId = async (userId: string) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase
    .from(tables.GROUP_MEMBERS_TBL)
    .select(
      `${tables.GROUPS_TBL} (
        id,
        created_at,
        name,
        category,
        avatar,
        admin:admin_id (id, email, phone, first_name, last_name, avatar),
        archived
      )`
    )
    .eq("member_id", userId);

  if (error) {
    throw error;
  }

  const groups = (data as any[])
    .map((item) => item[tables.GROUPS_TBL])
    .filter((group) => group.archived === false)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ) as Group[];
  const groupIds = groups.map((g) => g.id);

  const members = await getMembersByGroupIds(groupIds);

  return groups.map((group) => ({
    ...group,
    members: members.filter((m) => m.group_id === group.id)
  })) as (Group & { members: Member[] })[];
};

export const getGroupById = async (groupId: string) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase
    .from(tables.GROUPS_TBL)
    .select(`*, admin:admin_id (id, email, first_name, last_name, avatar)`)
    .eq("id", groupId)
    .single();

  if (error) {
    throw error;
  }

  return data as Group;
};

export const getStatsByGroupId = async (groupId: string) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  // total expenses amount, total paid amount, total owed amount, total members
  // get the total paid from expenses_split_tbl where expense_id in (select id from expenses_tbl where group_id = groupId and status = 'paid') and user_id = currentUserId
  // total expenses from expenses_tbl where group_id = groupId
  const { data, error } = await supabase
    .from(tables.GROUPS_TBL)
    .select(
      `
      id,
      total_expenses: ${tables.EXPENSES_TBL} (
        amount
      ),
      total_paid: ${tables.MEMBER_SPLITS_TBL} (
        amount,
        expense: ${tables.EXPENSES_TBL} (
          status
        )
      ),
      members: ${tables.GROUP_MEMBERS_TBL} (
        user_id
      )
    `
    )
    .eq("id", groupId)
    .single();

  console.log("data", JSON.stringify(data, null, 2));

  if (error) {
    throw error;
  }

  const totalExpenses = (data as any).total_expenses.reduce(
    (acc: number, expense: any) => acc + expense.amount,
    0
  );

  const totalPaid = (data as any).total_paid.reduce(
    (acc: number, split: any) => {
      if (split.expense.status === "paid") {
        return acc + split.amount;
      }
      return acc;
    },
    0
  );

  const membersCount = (data as any).members.length;

  return {
    totalExpenses,
    totalPaid,
    totalOwed: totalExpenses - totalPaid,
    membersCount
  };
};
