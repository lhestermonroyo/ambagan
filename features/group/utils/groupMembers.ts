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

/** The current user's own join timestamp for a group (epoch ms), read from its
 *  member list. Ranks groups by how recently *you* joined rather than when the
 *  group was created — so a group you just joined via an invite/QR sorts ahead
 *  of an older group you created earlier (whose `created_at` is more recent).
 *  Returns 0 when the user isn't in the member list (e.g. a stale cache). */
export const memberJoinedAtMs = (group: GroupWithMembers, userId?: string) => {
  const me = group.members?.find((m) => m.id === userId);
  return me?.joined_at ? new Date(me.joined_at).getTime() : 0;
};

/** The group to pre-select when starting a new expense: of the groups with
 *  enough members to split an expense, the one the current user most recently
 *  joined. Order-independent (ranks by each group's own join timestamp), so it
 *  behaves the same regardless of how the caller sorted the list. Returns null
 *  when no group qualifies. */
export const defaultExpenseGroup = <T extends GroupWithMembers>(
  groups: T[],
  userId?: string
): T | null => {
  const eligible = groups.filter(hasEnoughMembersForExpense);
  if (!eligible.length) return null;
  return eligible.reduce((best, group) =>
    memberJoinedAtMs(group, userId) > memberJoinedAtMs(best, userId)
      ? group
      : best
  );
};
