import { ExpensePreview } from "./expenses";
import { UserPreview } from "./user";

export type GroupState = {
  list: (Group & { members: Member[] })[];
  details: Group | null;
  memberList: Member[];
  expenseList: ExpensePreview[];
  memberTotalsList: MemberTotalsExpense[];
};

export type Group = {
  id: string;
  created_at: string;
  admin: UserPreview;
  name: string;
  category: string;
  avatar: string | null;
  archived: boolean;
};

export type Member = UserPreview & {
  id: string;
  group_id: string;
  joined_at: string;
};

export type MemberTotalsExpense = {
  member: UserPreview;
  total_paid: number;
  total_owed: number;
};

export enum GroupCategory {
  TRIP = "trip",
  EVENT = "event",
  HOUSEHOLD = "household",
  WORK = "work",
  COUPLE = "couple",
  FAMILY = "family",
  OTHER = "other"
}
