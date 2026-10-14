import { Group, GroupRole, Member } from "@/types/groups";

/**
 * Who may do what in a group. Two levels, and the difference matters at every
 * call site:
 *
 *   OWNER — `group.admin`, exactly one person (the creator, or whoever it was
 *           transferred to). Edits the group, archives it, deletes it, and
 *           decides who else is an admin.
 *   ADMIN — the owner PLUS any member whose {@link Member.role} is "admin".
 *           Manages the roster and the invite link, nothing more.
 *
 * Both mirror the SQL helpers of the same names (see
 * migrations/2026-08-19_group_co_admins.sql) — RLS is the real enforcement, so
 * a UI check that disagrees just produces a button that errors rather than a
 * hole. Keep the two definitions in step.
 */

/** True when the user owns the group. Owner-only actions gate on this. */
export const isGroupOwner = (
  group: Pick<Group, "admin"> | null | undefined,
  userId: string | undefined
): boolean => !!group && !!userId && group.admin?.id === userId;

/**
 * True when the user can manage the group's members and invite link — the
 * owner, or a member promoted to co-admin.
 *
 * `members` is optional so callers that only hold the group (a list row, a
 * cached detail without its roster) still get the correct answer for the
 * owner; they just can't see a co-admin's promotion until the roster loads.
 */
export const isGroupAdmin = (
  group: Pick<Group, "admin"> | null | undefined,
  members: Member[] | undefined,
  userId: string | undefined
): boolean => {
  if (isGroupOwner(group, userId)) return true;
  if (!userId || !members) return false;
  return members.some((m) => m.id === userId && m.role === GroupRole.ADMIN);
};

/**
 * The group's admins, owner first. The owner is unioned in rather than read
 * from their `role` alone: their membership row is backfilled to "admin", but a
 * cache written before co-admins shipped won't have it, and the owner must
 * never be missing from this list.
 */
export const groupAdmins = (
  group: Pick<Group, "admin"> | null | undefined,
  members: Member[]
): Member[] => {
  const ownerId = group?.admin?.id;
  return members.filter(
    (m) => m.id === ownerId || m.role === GroupRole.ADMIN
  );
};

/** Members who are not admins — the promotable half of the roster. */
export const groupNonAdmins = (
  group: Pick<Group, "admin"> | null | undefined,
  members: Member[]
): Member[] => {
  const ownerId = group?.admin?.id;
  return members.filter(
    (m) => m.id !== ownerId && m.role !== GroupRole.ADMIN
  );
};
