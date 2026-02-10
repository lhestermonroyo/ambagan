import { tables } from '@/utils/constants';
import { supabase } from '@/utils/supabase';

const getMembers = async (groupId: string) => {
  try {
    const { data, error } = await supabase
      .from(tables.GROUP_MEMBERS_TBL)
      .select('user_id')
      .eq('group_id', groupId);

    if (error) {
      throw error;
    }

    return data?.map((member) => member.user_id) || [];
  } catch (error) {
    console.error('Error fetching group members:', error);
    return [];
  }
};

export { getMembers };
