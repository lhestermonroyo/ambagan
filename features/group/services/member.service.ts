import { Member } from "@/types/groups";
import { tables } from "@/utils/constants";
import { supabase } from "@/utils/supabase";

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
