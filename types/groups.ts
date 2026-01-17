import { User } from './auth';

type UserPreview = Pick<
  User,
  'id' | 'email' | 'first_name' | 'last_name' | 'avatar_url'
>;

export type Group = {
  id: string;
  created_at: string;
  creator: UserPreview;
  name: string;
  description: string;
  color: string;
  avatar: string | null;
  members: UserPreview[];
};
