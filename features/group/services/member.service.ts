import { createNotification } from "@/features/notifications/services/notification.service";
import { NotificationType } from "@/types/notifications";
import { Member } from "@/types/groups";
import { tables } from "@/utils/constants";
import { supabase } from "@/utils/supabase";

export const leaveGroup = async (
  groupId: string,
  userId: string,
  newAdminId?: string
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

  if (groupError) throw groupError;

  const isAdmin = groupData.admin_id === userId;

  if (isAdmin) {
    if (!newAdminId) {
      const { data: otherMembers, error: membersError } = await supabase
        .from(tables.GROUP_MEMBERS_TBL)
        .select("member_id")
        .eq("group_id", groupId)
        .neq("member_id", userId)
        .limit(1);

      if (membersError) throw membersError;

      if (otherMembers.length === 0) {
        const { error: deleteGroupError } = await supabase
          .from(tables.GROUPS_TBL)
          .delete()
          .eq("id", groupId);

        if (deleteGroupError) throw deleteGroupError;

        return { success: true, groupDeleted: true };
      }
    }

    const { error: transferError } = await supabase
      .from(tables.GROUPS_TBL)
      .update({ admin_id: newAdminId })
      .eq("id", groupId);

    if (transferError) throw transferError;
  }

  const { error } = await supabase
    .from(tables.GROUP_MEMBERS_TBL)
    .delete()
    .eq("group_id", groupId)
    .eq("member_id", userId);

  if (error) throw error;

  const { data: remainingMembers, error: membersError } = await supabase
    .from(tables.GROUP_MEMBERS_TBL)
    .select("member_id")
    .eq("group_id", groupId);

  if (!membersError && remainingMembers && remainingMembers.length > 0) {
    await Promise.allSettled(
      remainingMembers.map((member) =>
        createNotification({
          fromUserId: userId,
          toUserId: member.member_id,
          type: NotificationType.GROUP_LEAVE,
          referenceId: groupId
        })
      )
    );
  }

  return { success: true, groupDeleted: false };
};

export const updateGroupMembers = async (
  groupId: string,
  membersToAdd: string[],
  membersToRemove: string[]
) => {
  const responses = await Promise.all([
    ...membersToAdd.map((memberId) => {
      return supabase.from(tables.GROUP_MEMBERS_TBL).insert([
        {
          group_id: groupId,
          member_id: memberId
        }
      ]);
    }),
    ...membersToRemove.map((memberId) => {
      return supabase
        .from(tables.GROUP_MEMBERS_TBL)
        .delete()
        .eq("group_id", groupId)
        .eq("member_id", memberId);
    })
  ]);

  for (const response of responses) {
    if (response.error) {
      throw response.error;
    }
  }

  const allMembers = await getMembersByGroupId(groupId);

  return {
    message: "Group members updated successfully",
    data: allMembers
  };
};

export const getMembersByGroupId = async (groupId: string) => {
  const { data, error } = await supabase
    .from(tables.GROUP_MEMBERS_TBL)
    .select(
      `id, group_id, joined_at, member:member_id (id, email, phone, first_name, last_name, avatar)`
    )
    .eq("group_id", groupId);

  if (error) {
    throw error;
  }

  return (data as any[]).map((item) => ({
    ...item["member"],
    joined_at: item.joined_at,
    group_id: item.group_id
  })) as Member[];
};

export const getMembersByGroupIds = async (groupIds: string[]) => {
  if (groupIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from(tables.GROUP_MEMBERS_TBL)
    .select(
      `id, group_id, joined_at, member:member_id (id, first_name, last_name, avatar)`
    )
    .in("group_id", groupIds);

  if (error) {
    throw error;
  }

  return (data as any[]).map((item) => ({
    ...item["member"],
    joined_at: item.joined_at,
    group_id: item.group_id
  })) as Member[];
};
