import { tables } from '@/utils/constants';
import { supabase } from '@/utils/supabase';
import { uploadFile } from '@/utils/upload';
import { ImagePickerSuccessResult } from 'expo-image-picker';
import 'react-native-get-random-values';
import { v4 as uuid } from 'uuid';

export const saveGroup = async ({
  name,
  description,
  cover,
  category,
  members
}: {
  name: string;
  description: string;
  cover: ImagePickerSuccessResult | null;
  category: string;
  members: string[];
}) => {
  try {
    const user = await supabase.auth.getUser();

    if (!user.data.user) {
      throw new Error('User not authenticated');
    }

    const groupId = uuid();
    const creator = user.data.user.id;
    let coverUrl: string | null = null;

    if (cover) {
      const uploadResponse = await uploadFile(cover.assets[0], 'group_covers');

      if (!uploadResponse.error) {
        coverUrl = uploadResponse.data?.publicUrl || null;
      }
    }
    const responses = await Promise.all([
      supabase.from(tables.GROUPS_TBL).insert([
        {
          id: groupId,
          creator,
          name,
          description,
          category,
          cover: coverUrl
        }
      ]),
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
      message: 'Group created successfully',
      data: {
        groupId
      }
    };
  } catch (error) {
    console.error('Error saving group:', error);
  }
};
