import { ExpensePreview, Payment } from "./expenses";
import { UserPreview } from "./user";

export type GroupState = {
  list: (Group & { members: Member[] })[];
  /** True once the group list has been fetched at least once, so consumers can
   * tell "still loading" apart from "genuinely has no groups". */
  initialized: boolean;
  details: Group | null;
  memberList: Member[];
  expenseList: ExpensePreview[];
  settlementList: Payment[];
  settlementRefreshToken: number;
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
  /** Stable invite token for the share link / QR. Present on group detail
   *  (getGroupById selects `*`); omitted from lighter list queries. */
  invite_token?: string;
  /** When the invite token stops working. null/undefined = never expires.
   *  Rotated via reset_group_invite. Present on group detail only. */
  invite_token_expires_at?: string | null;
  /** True for a group created offline and not yet synced to the server. */
  pending?: boolean;
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
