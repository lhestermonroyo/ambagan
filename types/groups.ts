import { ExpensePreview, Payment } from "./expenses";
import { UserPreview } from "./user";

export type GroupState = {
  list: (Group & { members: Member[] })[];
  /** True once the group list has been fetched at least once, so consumers can
   * tell "still loading" apart from "genuinely has no groups". */
  initialized: boolean;
  details: Group | null;
  /** Display-only summary from the row that opened the details screen. */
  headerPreview: GroupHeaderPreview | null;
  memberList: Member[];
  expenseList: ExpensePreview[];
  settlementList: Payment[];
  settlementRefreshToken: number;
};

export type GroupHeaderPreview = Pick<
  Group,
  | "id"
  | "name"
  | "avatar"
  | "created_at"
  | "last_updated_at"
  | "expense_count"
  | "currency"
>;

export enum GroupMode {
  GROUP = "group",
  INDIVIDUAL = "individual"
}

export type Group = {
  id: string;
  /** Individual entries use the private ledger; legacy snapshots default to Group. */
  mode?: GroupMode;
  created_at: string;
  /** Latest group activity, maintained by database triggers. Optional only for
   *  older offline snapshots; sorting falls back to created_at. */
  last_updated_at?: string | null;
  /** The group's OWNER — whoever created it (groups_tbl.admin_id), or whoever
   *  it was transferred to when they left. Exactly one, and the only person who
   *  can edit/archive/delete the group or promote a member to co-admin. Other
   *  members may hold {@link GroupRole.ADMIN}; see {@link Member.role}. */
  admin: UserPreview;
  name: string;
  category: string;
  avatar: string | null;
  /** The group's REPORTING currency — what the stats tab, the member breakdown
   *  and the To Collect / To Pay totals convert into. Free groups are always
   *  "PHP". Mirrors {@link Book.currency}.
   *
   *  It is NOT what Add Expense prefills — see
   *  {@link Group.default_expense_currency}. */
  currency: string;
  /** The currency NEW expenses on this group start in, when it should differ
   *  from {@link Group.currency} — a trip reported in PHP but spent in JPY.
   *
   *  null (the common case) means "same as the group's currency". Never stored
   *  equal to `currency`: the services normalize that back to null so a later
   *  currency edit carries over instead of leaving a stale frozen copy. Always
   *  resolve it through `groupEntryCurrency()` rather than reading it raw.
   *
   *  Mirrors {@link Book.default_expense_currency}, but note the difference in
   *  blast radius: a book's is the owner's alone, a group's applies to every
   *  member's Add Expense. */
  default_expense_currency: string | null;
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
  /** What this member may do in the group. `"admin"` is a CO-ADMIN: they can
   *  edit the roster and share/reset the invite link, but not edit, archive,
   *  delete, or hand out admin — those stay with the owner ({@link Group.admin}).
   *
   *  The owner's own membership row is kept at `"admin"` too, so "who are the
   *  admins?" is a plain filter on this field. Never trust it for a permission
   *  decision on its own — go through `isGroupAdmin()` / `isGroupOwner()` in
   *  features/group/utils/groupRoles, which fall back to the owner id when the
   *  roster is stale or hasn't loaded. Defaults to `"member"` when absent (an
   *  older cached row written before co-admins shipped). */
  role?: GroupRole;
};

export enum GroupRole {
  /** Can add/remove members and share or reset the invite link. */
  ADMIN = "admin",
  MEMBER = "member"
}

export enum GroupCategory {
  GENERAL = "general",
  TRIP = "trip",
  EVENT = "event",
  HOUSEHOLD = "household",
  WORK = "work",
  COUPLE = "couple",
  FAMILY = "family",
  OTHER = "other"
}
