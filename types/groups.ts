import { UserPreview } from './auth';
import { TransactionPreview } from './transactions';

export type GroupState = {
  groups: GroupPreview[];
  details: Group | null;
};

export type Group = {
  id: string;
  created_at: string;
  creator: UserPreview;
  name: string;
  description: string;
  color: string;
  avatar: string | null;
  members: Member[];
  transactions: TransactionPreview[];
};

export type Member = {
  joined_at: string;
  user: UserPreview;
};

export type GroupPreview = Pick<
  Group,
  'id' | 'created_at' | 'creator' | 'name' | 'avatar' | 'color'
>;
