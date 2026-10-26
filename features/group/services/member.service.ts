import { createOrGetPlaceholder } from "@/features/user/services/user.service";
import { createNotification } from "@/features/notifications/services/notification.service";
import { NotificationType } from "@/types/notifications";
import { GroupRole, Member } from "@/types/groups";
import { UserPreview } from "@/types/user";
import { tables } from "@/utils/constants";
import { supabase } from "@/utils/supabase";
import { sendPushNotification } from "@/utils/sendPushNotifications";

/** Temp id prefix for a picked phone contact before it's resolved to a real
 *  placeholder id (see resolveContactMembers). */
export const CONTACT_MEMBER_PREFIX = "contact:";

/** True if the list still contains unresolved phone-contact members. */
export const hasUnresolvedContacts = (members: UserPreview[]): boolean =>
  members.some(
    (m) => !!m.is_placeholder && m.id.startsWith(CONTACT_MEMBER_PREFIX)
  );

/**
 * Turn any unresolved phone-contact members (temp id `contact:<phone>`) into
 * real placeholder user ids via the RPC, so they can be written to
 * group_members. Non-contact members pass through unchanged. Online-only — the
 * RPC de-dupes ghosts by phone server-side, so ids can't be generated offline.
 */
export const resolveContactMembers = async (
  members: UserPreview[]
): Promise<UserPreview[]> => {
  return Promise.all(
    members.map(async (m) => {
      if (
        m.is_placeholder &&
        m.id.startsWith(CONTACT_MEMBER_PREFIX) &&
        m.phone
      ) {
        const id = await createOrGetPlaceholder(
          m.phone,
          m.first_name,
          m.last_name
        );
        return { ...m, id };
      }
      return m;
    })
  );
};

export const leaveGroup = async (
  groupId: string,
  userId: string,
  newAdminId?: string
) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const { data: groupData, error: groupError } = await supabase
    .from(tables.GROUPS_TBL)
    .select("admin_id")
    .eq("id", groupId)
    .single();

  if (groupError) throw groupError;

  const isOwner = groupData.admin_id === userId;

  if (isOwner) {
    if (!newAdminId) {
      const { data: otherMembers, error: membersError } = await supabase
        .from(tables.GROUP_MEMBERS_TBL)
        .select("member_id")
        .eq("group_id", groupId)
        .neq("member_id", userId)
        .limit(1);

      if (membersError) throw membersError;

      if (otherMembers.length === 0) {
        const { error: deleteGroupError } = await supabase
          .from(tables.GROUPS_TBL)
          .delete()
          .eq("id", groupId);

        if (deleteGroupError) throw deleteGroupError;

        return { success: true, groupDeleted: true };
      }
    }

    const { error: transferError } = await supabase
      .from(tables.GROUPS_TBL)
      .update({ admin_id: newAdminId })
      .eq("id", groupId);

    if (transferError) throw transferError;

    // Ownership carries admin with it. The new owner is an admin structurally
    // (RLS reads groups_tbl.admin_id), but their membership row still has to
    // say so or they'd be missing from the group's admin list in the UI. Done
    // as the OLD owner, while they still pass the owner check on the row.
    // Non-fatal: the transfer above is what actually matters, and
    // is_group_admin() covers them either way.
    await supabase
      .from(tables.GROUP_MEMBERS_TBL)
      .update({ role: GroupRole.ADMIN })
      .eq("group_id", groupId)
      .eq("member_id", newAdminId);
  }

  const { error } = await supabase
    .from(tables.GROUP_MEMBERS_TBL)
    .delete()
    .eq("group_id", groupId)
    .eq("member_id", userId);

  if (error) throw error;

  const { data: remainingMembers, error: membersError } = await supabase
    .from(tables.GROUP_MEMBERS_TBL)
    .select("member_id")
    .eq("group_id", groupId);

  if (!membersError && remainingMembers && remainingMembers.length > 0) {
    await Promise.allSettled(
      remainingMembers.map((member) =>
        Promise.all([
          createNotification({
            fromUserId: userId,
            toUserId: member.member_id,
            type: NotificationType.GROUP_LEAVE,
            referenceId: groupId
          }),
          sendPushNotification(member.member_id, NotificationType.GROUP_LEAVE, {
            title: "Member Left",
            body: "A member has left your group",
            referenceId: groupId
          })
        ])
      )
    );
  }

  return { success: true, groupDeleted: false };
};

export const updateGroupMembers = async (
  groupId: string,
  membersToAdd: string[],
  membersToRemove: string[]
) => {
  const responses = await Promise.all([
    ...membersToAdd.map((memberId) => {
      // Upsert (ignore duplicates) so a re-synced offline add — or the same
      // member added from two devices — never creates a duplicate membership.
      return supabase.from(tables.GROUP_MEMBERS_TBL).upsert(
        {
          group_id: groupId,
          member_id: memberId
        },
        { onConflict: "group_id,member_id", ignoreDuplicates: true }
      );
    }),
    ...membersToRemove.map((memberId) => {
      return supabase
        .from(tables.GROUP_MEMBERS_TBL)
        .delete()
        .eq("group_id", groupId)
        .eq("member_id", memberId);
    })
  ]);

  for (const response of responses) {
    if (response.error) {
      throw response.error;
    }
  }

  const allMembers = await getMembersByGroupId(groupId);

  return {
    message: "Group members updated successfully",
    data: allMembers
  };
};

export const getMembersByGroupId = async (groupId: string) => {
  const { data, error } = await supabase
    .from(tables.GROUP_MEMBERS_TBL)
    .select(
      `id, group_id, joined_at, role, member:member_id (id, email, phone, first_name, last_name, avatar, is_placeholder)`
    )
    .eq("group_id", groupId);

  if (error) {
    throw error;
  }

  return (data as any[]).map((item) => ({
    ...item["member"],
    joined_at: item.joined_at,
    group_id: item.group_id,
    // Rows written before co-admins shipped have no role; treat them as plain
    // members (the column's own default) rather than leaving it undefined.
    role: (item.role as GroupRole) ?? GroupRole.MEMBER
  })) as Member[];
};

export const getMembersByGroupIds = async (groupIds: string[]) => {
  if (groupIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from(tables.GROUP_MEMBERS_TBL)
    .select(
      `id, group_id, joined_at, role, member:member_id (id, first_name, last_name, avatar)`
    )
    .in("group_id", groupIds);

  if (error) {
    throw error;
  }

  return (data as any[]).map((item) => ({
    ...item["member"],
    joined_at: item.joined_at,
    group_id: item.group_id,
    // Rows written before co-admins shipped have no role; treat them as plain
    // members (the column's own default) rather than leaving it undefined.
    role: (item.role as GroupRole) ?? GroupRole.MEMBER
  })) as Member[];
};

/**
 * Promote a member to co-admin, or demote one back. OWNER ONLY — enforced by
 * set_group_member_role(), which also refuses to touch the owner's own row and
 * rejects anyone who isn't a member of the group.
 *
 * Online-only, like the other structural admin actions (resetting the invite
 * link): there's no safe optimistic story for a permission change, and a queued
 * promotion could land after the person had already been removed.
 */
export const setMemberRole = async (
  groupId: string,
  memberId: string,
  role: GroupRole
) => {
  const { error } = await supabase.rpc("set_group_member_role", {
    _group_id: groupId,
    _member_id: memberId,
    _role: role
  });

  if (error) throw error;

  return { success: true };
};
