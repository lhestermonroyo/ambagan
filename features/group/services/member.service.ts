import { tables } from "@/utils/constants";
import { supabase } from "@/utils/supabase";

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
