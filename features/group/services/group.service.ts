import { createNotification } from "@/features/notifications/services/notification.service";
import { NotificationType } from "@/types/notifications";
import { Group, Member } from "@/types/groups";
import { cacheService } from "@/utils/cacheService";
import { tables } from "@/utils/constants";
import { supabase } from "@/utils/supabase";
import { uploadFile } from "@/utils/upload";
import { sendPushNotification } from "@/utils/sendPushNotifications";
import { ImagePickerSuccessResult } from "expo-image-picker";
import "react-native-get-random-values";
import { v4 as uuid } from "uuid";
import { getMembersByGroupIds } from "./member.service";

export const saveGroup = async ({
  name,
  avatar,
  category,
  admin_id,
  member_ids,
  id
}: {
  name: string;
  category: string;
  avatar: ImagePickerSuccessResult | null;
  admin_id: string;
  member_ids: string[];
  /** Optional pre-generated id — used so offline-queued groups keep a stable id on sync. */
  id?: string;
}) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  if (admin_id !== user.data.user.id) {
    throw new Error("Admin ID must be the same as the authenticated user");
  }

  const groupId = id ?? uuid();
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

  const membersToNotify = member_ids.filter((id) => id !== admin_id);

  await Promise.allSettled(
    membersToNotify.map((memberId) =>
      Promise.all([
        createNotification({
          fromUserId: admin_id,
          toUserId: memberId,
          type: NotificationType.GROUP_JOIN,
          referenceId: groupId
        }),
        sendPushNotification(memberId, NotificationType.GROUP_JOIN, {
          title: "Added to a Group",
          body: `You've been added to "${name}"`,
          referenceId: groupId
        })
      ])
    )
  );

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
    const [paymentsRes, payersRes, splitsRes] = await Promise.all([
      supabase
        .from(tables.PAYMENT_SPLITS_TBL)
        .delete()
        .in("expense_id", expenseIds),
      supabase
        .from(tables.EXPENSE_PAYERS_TBL)
        .delete()
        .in("expense_id", expenseIds),
      supabase
        .from(tables.MEMBER_SPLITS_TBL)
        .delete()
        .in("expense_id", expenseIds)
    ]);

    if (paymentsRes.error) throw paymentsRes.error;
    if (payersRes.error) throw payersRes.error;
    if (splitsRes.error) throw splitsRes.error;

    const { error: deleteExpensesError } = await supabase
      .from(tables.EXPENSES_TBL)
      .delete()
      .in("id", expenseIds);

    if (deleteExpensesError) throw deleteExpensesError;
  }

  const { error: membersError } = await supabase
    .from(tables.GROUP_MEMBERS_TBL)
    .delete()
    .eq("group_id", groupId);

  if (membersError) throw membersError;

  const groupResponse = await supabase
    .from(tables.GROUPS_TBL)
    .delete()
    .eq("id", groupId);

  if (groupResponse.error) throw groupResponse.error;

  return {
    success: true,
    message: "Group deleted successfully"
  };
};

export const getGroupsByUserId = async (userId: string) => {
  try {
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
          admin:admin_id (id, email, phone, first_name, last_name, avatar, plan),
          archived,
          expenses:${tables.EXPENSES_TBL}(count)
        )`
      )
      .eq("member_id", userId);

    if (error) {
      throw error;
    }

    const groups = (data as any[])
      .map((item) => {
        const { expenses: expData, ...group } = item[tables.GROUPS_TBL];
        return {
          ...group,
          expense_count: (expData as any[])?.[0]?.count ?? 0
        };
      })
      .filter((group) => group.archived === false)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ) as Group[];
    const groupIds = groups.map((g) => g.id);

    const members = await getMembersByGroupIds(groupIds);

    const result = groups.map((group) => ({
      ...group,
      members: members.filter((m) => m.group_id === group.id)
    })) as (Group & { members: Member[] })[];

    // Persist the fresh snapshot so the list is viewable offline.
    cacheService.saveGroupsList(userId, result).catch(() => {});

    return result;
  } catch (error) {
    // Offline / fetch failure — fall back to the last cached snapshot.
    const cached = await cacheService.getGroupsList(userId);
    if (cached) {
      return cached as (Group & { members: Member[] })[];
    }
    throw error;
  }
};

const GROUPS_PAGE_SIZE = 15;

export type GroupFilter = "all" | "created" | "joined" | "archived";

export const getGroupsByUserIdPaginated = async (
  userId: string,
  page: number = 0,
  filter: GroupFilter = "all"
): Promise<{ data: (Group & { members: Member[] })[]; hasNext: boolean }> => {
  try {
    const user = await supabase.auth.getUser();
    if (!user.data.user) throw new Error("User not authenticated");

    const from = page * GROUPS_PAGE_SIZE;
    const to = from + GROUPS_PAGE_SIZE - 1;

    let query = supabase
      .from(tables.GROUPS_TBL)
      .select(
        `id, created_at, name, category, avatar, archived,
         admin:admin_id (id, email, phone, first_name, last_name, avatar, plan),
         ${tables.GROUP_MEMBERS_TBL}!inner(member_id),
         expenses:${tables.EXPENSES_TBL}(count)`,
        { count: "exact" }
      )
      .eq(`${tables.GROUP_MEMBERS_TBL}.member_id`, userId)
      .eq("archived", filter === "archived")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (filter === "created") {
      query = query.eq("admin_id", userId);
    } else if (filter === "joined") {
      query = query.neq("admin_id", userId);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    const groups = (data as any[]).map(({ group_members_tbl: _, expenses: expData, ...group }) => ({
      ...group,
      expense_count: (expData as any[])?.[0]?.count ?? 0
    })) as Group[];
    const groupIds = groups.map((g) => g.id);
    const members = groupIds.length ? await getMembersByGroupIds(groupIds) : [];

    const totalPages = Math.ceil((count || 0) / GROUPS_PAGE_SIZE);

    const result = {
      data: groups.map((group) => ({
        ...group,
        members: members.filter((m) => m.group_id === group.id)
      })),
      hasNext: page < totalPages - 1
    };

    // Cache the first "all" page when it's the complete list (no more pages),
    // so the Groups tab is viewable offline. Skip when there are more pages to
    // avoid shrinking a fuller snapshot already cached by the home tab.
    if (page === 0 && filter === "all" && !result.hasNext) {
      cacheService.saveGroupsList(userId, result.data).catch(() => {});
    }

    return result;
  } catch (error) {
    // Offline / fetch failure — serve from the cached snapshot. The cache holds
    // the full non-archived list, so we filter it by tab and return it on the
    // first page (pagination isn't available offline).
    if (page > 0) return { data: [], hasNext: false };

    const cached = (await cacheService.getGroupsList(userId)) as
      | (Group & { members: Member[] })[]
      | null;
    if (!cached) throw error;

    let data = cached;
    if (filter === "created") {
      data = cached.filter((g) => g.admin?.id === userId);
    } else if (filter === "joined") {
      data = cached.filter((g) => g.admin?.id !== userId);
    } else if (filter === "archived") {
      // Archived groups aren't cached (the snapshot excludes them).
      data = [];
    }

    return { data, hasNext: false };
  }
};

export const getGroupById = async (groupId: string) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase
    .from(tables.GROUPS_TBL)
    .select(`*, admin:admin_id (id, email, phone, first_name, last_name, avatar, plan)`)
    .eq("id", groupId)
    .single();

  if (error) {
    throw error;
  }

  return data as Group;
};

export const archiveGroup = async (groupId: string) => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from(tables.GROUPS_TBL)
    .update({ archived: true })
    .eq("id", groupId)
    .eq("admin_id", user.data.user.id);

  if (error) throw error;
  return { success: true };
};

export const unarchiveGroup = async (groupId: string) => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from(tables.GROUPS_TBL)
    .update({ archived: false })
    .eq("id", groupId)
    .eq("admin_id", user.data.user.id);

  if (error) throw error;
  return { success: true };
};

export const getActiveAdminGroupsCount = async (userId: string): Promise<number> => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { count, error } = await supabase
    .from(tables.GROUPS_TBL)
    .select("id", { count: "exact", head: true })
    .eq("admin_id", userId)
    .eq("archived", false);

  if (error) throw error;
  return count ?? 0;
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
