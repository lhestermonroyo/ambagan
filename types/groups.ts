import { ExpensePreview, Payment } from "./expenses";
import { UserPreview } from "./user";

export type GroupState = {
  list: (Group & { members: Member[] })[];
  details: Group | null;
  memberList: Member[];
  expenseList: ExpensePreview[];
  settlementList: Payment[];
};

export type Group = {
  id: string;
  created_at: string;
  admin: UserPreview;
  name: string;
  category: string;
  avatar: string | null;
  archived: boolean;
  expense_count: number;
};

export type Member = UserPreview & {
  id: string;
  group_id: string;
  joined_at: string;
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
