import { Expense } from "./expenses";
import { UserPreview } from "./user";

export type GroupState = {
  preview: Group[];
  list: Group[];
  details: GroupDetails | null;
};

export type Group = {
  id: string;
  created_at: string;
  creator: UserPreview;
  name: string;
  category: string;
  avatar: string | null;
  members_count: number;
};

export type GroupDetails = Group & { members: Member[] } & {
  expenses: Expense[];
};

export type Member = UserPreview & { joined_at: string };

export enum GroupCategory {
  TRIP = "trip",
  EVENT = "event",
  HOUSEHOLD = "household",
  COUPLE = "couple",
  FAMILY = "family",
  OTHER = "other"
}
