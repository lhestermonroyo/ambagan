import { tables } from "@/utils/constants";
import { supabase } from "@/utils/supabase";

export const updateGroupMembers = async (
  groupId: string,
  membersToAdd: string[],
  membersToRemove: string[]
) => {
  const responses = await Promise.all([
    ...membersToAdd.map((userId) => {
      return supabase.from(tables.GROUP_MEMBERS_TBL).insert([
        {
          group_id: groupId,
          user_id: userId
        }
      ]);
    }),
    ...membersToRemove.map((userId) => {
      return supabase
        .from(tables.GROUP_MEMBERS_TBL)
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", userId);
    })
  ]);

  for (const response of responses) {
    if (response.error) {
      throw response.error;
    }
  }

  return {
    message: "Group members updated successfully"
  };
};

export const getMembersByGroupId = async (groupId: string) => {
  const { data, error } = await supabase
    .from(tables.GROUP_MEMBERS_TBL)
    .select(
      `joined_at, ${tables.USERS_TBL} (id, email, first_name, last_name, avatar)`
    )
    .eq("group_id", groupId);

  if (error) {
    throw error;
  }

  return (
    (data as any[]).map((item) => ({
      ...item[tables.USERS_TBL],
      joined_at: item.joined_at
    })) || []
  );
};
