import { Group, Member } from "@/types/groups";

/** Minimum members a group needs before an expense can be split within it — the
 *  creator plus at least one other person. Groups below this can't have an
 *  expense added (mirrors the `memberCount >= 2` submit gate), so they're
 *  skipped when auto-selecting a default group and hidden from the expense
 *  group picker. */
export const MIN_GROUP_MEMBERS_FOR_EXPENSE = 2;

type GroupWithMembers = Group & { members?: Member[] };

/** True when a group has enough members to add/split an expense. */
export const hasEnoughMembersForExpense = (group: GroupWithMembers) =>
  (group.members?.length ?? 0) >= MIN_GROUP_MEMBERS_FOR_EXPENSE;
