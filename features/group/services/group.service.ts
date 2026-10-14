import { createNotification } from "@/features/notifications/services/notification.service";
import states from "@/states";
import { NotificationType } from "@/types/notifications";
import { Group, GroupMode, GroupRole, Member } from "@/types/groups";
import type { Book } from "@/types/books";
import { individualGroupEntry, isIndividualGroup } from "@/features/group/utils/groupMode";
import { normalizeEntryCurrency } from "@/features/group/utils/groupCurrency";
import { compareGroupsByActivity, sortGroupsByActivity } from "@/features/group/utils/groupActivity";
import { cacheService } from "@/utils/cacheService";
import { tables } from "@/utils/constants";
import * as offlineQueue from "@/utils/offlineQueue";
import { isUniqueViolation, supabase } from "@/utils/supabase";
import { uploadFile } from "@/utils/upload";
import { sendPushNotification } from "@/utils/sendPushNotifications";
import { ImagePickerSuccessResult } from "expo-image-picker";
import "react-native-get-random-values";
import { v4 as uuid } from "uuid";
import { getMembersByGroupIds } from "./member.service";

export const saveGroup = async ({
  name,
  avatar,
  category,
  currency,
  default_expense_currency,
  admin_id,
  member_ids,
  admin_member_ids = [],
  id
}: {
  name: string;
  category: string;
  /** The group's REPORTING currency (free = "PHP"; Pro can pick). */
  currency: string;
  /** What Add Expense prefills. Null/omitted = follow `currency`. */
  default_expense_currency?: string | null;
  avatar: ImagePickerSuccessResult | null;
  admin_id: string;
  member_ids: string[];
  /** Members selected as co-admins by the owner during creation. */
  admin_member_ids?: string[];
  /** Optional pre-generated id — used so offline-queued groups keep a stable id on sync. */
  id?: string;
}) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  if (admin_id !== user.data.user.id) {
    throw new Error("Admin ID must be the same as the authenticated user");
  }

  const membershipIds = [...new Set([admin_id, ...member_ids])];
  const selectedAdmins = new Set(admin_member_ids);
  if (admin_member_ids.some((memberId) => !membershipIds.includes(memberId))) {
    throw new Error("Admins must be selected group members");
  }

  const groupId = id ?? uuid();
  let avatarUrl: string | null = null;

  if (avatar) {
    const uploadResponse = await uploadFile(avatar.assets[0], "avatars");

    if (uploadResponse.error) throw uploadResponse.error;

    avatarUrl = uploadResponse.data?.publicUrl || null;
  }

  const groupResponse = await supabase.from(tables.GROUPS_TBL).insert([
    {
      id: groupId,
      name,
      category,
      currency,
      // Normalized, never stored equal to `currency` — see normalizeEntryCurrency.
      default_expense_currency: normalizeEntryCurrency(
        default_expense_currency,
        currency
      ),
      avatar: avatarUrl,
      admin_id
    }
  ]);

  // Idempotent sync retries: an offline create isn't atomic (the group row and
  // its member rows are separate calls), so a mid-write failure can leave the
  // group committed but memberless. On the retry the insert hits a unique
  // violation — treat that as a repair pass rather than a failure: re-upsert the
  // member rows below and skip notifications (already sent on first commit). Any
  // other error is real → rethrow.
  const isRepair = !!groupResponse.error;
  if (groupResponse.error && !isUniqueViolation(groupResponse.error)) {
    throw groupResponse.error;
  }

  // Upsert (ignore duplicates) so a repair pass only fills in the member rows a
  // partial prior write missed, and a re-synced add never duplicates a row.
  const responses = await Promise.all([
    ...membershipIds.map((id) => {
      return supabase.from(tables.GROUP_MEMBERS_TBL).upsert(
        {
          group_id: groupId,
          member_id: id,
          // The owner's own row carries role "admin" so the client can list a
          // group's admins as a plain filter on the roster. It is NOT what
          // makes them the owner — that's groups_tbl.admin_id, which RLS reads
          // directly (see migrations/2026-08-19_group_co_admins.sql).
          role: id === admin_id || selectedAdmins.has(id)
            ? GroupRole.ADMIN
            : GroupRole.MEMBER
        },
        { onConflict: "group_id,member_id", ignoreDuplicates: true }
      );
    })
  ]);

  for (const response of responses) {
    if (response.error) {
      throw response.error;
    }
  }

  if (!isRepair) {
    const membersToNotify = membershipIds.filter((id) => id !== admin_id);

    await Promise.allSettled(
      membersToNotify.map((memberId) =>
        Promise.all([
          createNotification({
            fromUserId: admin_id,
            toUserId: memberId,
            type: NotificationType.GROUP_JOIN,
            referenceId: groupId
          }),
          sendPushNotification(memberId, NotificationType.GROUP_JOIN, {
            title: "Added to a Group",
            body: `You've been added to "${name}"`,
            referenceId: groupId
          })
        ])
      )
    );
  }

  return {
    message: "Group created successfully",
    data: {
      groupId
    }
  };
};

/** The entry currency a group currently holds, read from whatever the app
 *  already has in memory. Only used on the offline path, where the queued op
 *  can't say "leave this column alone" — see updateGroup. */
const currentEntryCurrency = (groupId: string): string | null => {
  const state = states.group.getState();
  const group =
    state.details?.id === groupId
      ? state.details
      : state.list.find((g) => g.id === groupId);
  return group?.default_expense_currency ?? null;
};

export const updateGroup = async (
  groupId: string,
  payload: {
    name: string;
    category: string;
    currency: string;
    /** Omit to leave the stored value alone; null/"" clears it back to
     *  "same as the group currency". */
    default_expense_currency?: string | null;
    avatar: ImagePickerSuccessResult | null;
  }
) => {
  // Offline → queue name/category/currencies (avatar uploads are blocked
  // offline, so it stays null) + optimistic cache. Folds into a still-pending
  // create.
  if (!(await offlineQueue.isOnline())) {
    const uid = states.user.getState().details?.id;
    if (uid) {
      // The queue op carries a concrete value, so unlike the online path below
      // it has no way to express "don't touch this column". Resolve the absent
      // case here instead — from the group we already hold — or an offline edit
      // that never mentioned the entry currency would silently clear it.
      const entryCurrency =
        payload.default_expense_currency !== undefined
          ? payload.default_expense_currency
          : currentEntryCurrency(groupId);

      await offlineQueue.queueUpdateGroup(uid, groupId, {
        name: payload.name,
        category: payload.category,
        currency: payload.currency,
        default_expense_currency: normalizeEntryCurrency(
          entryCurrency,
          payload.currency
        ),
        avatar: null
      });
    }
    return { message: "Group will be updated when you're back online" };
  }

  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const { data: groupData, error: groupError } = await supabase
    .from(tables.GROUPS_TBL)
    .select("admin_id")
    .eq("id", groupId)
    .single();

  if (groupError) {
    throw groupError;
  }

  if (groupData.admin_id !== user.data.user.id) {
    throw new Error("Only the group owner can update the group");
  }

  const { name, category, currency, default_expense_currency, avatar } =
    payload;

  let avatarUrl: string | null = null;

  if (avatar) {
    const uploadResponse = await uploadFile(avatar.assets[0], "avatars");

    if (uploadResponse.error) throw uploadResponse.error;

    avatarUrl = uploadResponse.data?.publicUrl || null;
  }

  const updateData: Record<string, any> = {
    name,
    category,
    currency
  };

  // Written whenever the caller passed the key at all — including as null, which
  // is a real value here ("follow the group currency") and must be able to clear
  // a previously pinned code. `undefined` means "not editing this", so the
  // column is left untouched rather than silently reset. Re-normalized against
  // the currency being saved in the same write, so changing the group currency
  // to match a pinned entry currency collapses the pin instead of freezing it.
  if (default_expense_currency !== undefined) {
    updateData.default_expense_currency = normalizeEntryCurrency(
      default_expense_currency,
      currency
    );
  }

  if (avatarUrl) {
    updateData.avatar = avatarUrl;
  }

  const { error } = await supabase
    .from(tables.GROUPS_TBL)
    .update(updateData)
    .eq("id", groupId);

  if (error) {
    throw error;
  }

  return {
    message: "Group updated successfully"
  };
};

export const deleteGroup = async (groupId: string) => {
  // Hard cascade delete — ONLINE ONLY. Unlike archive/unarchive there is no
  // offline queue path: a destructive cascade must not run optimistically and
  // then diverge from the server (e.g. if a member added an expense elsewhere
  // before it syncs). Block it cleanly offline; the callers' catch blocks
  // surface this message as a toast.
  if (!(await offlineQueue.isOnline())) {
    throw new Error(
      "Deleting a group needs an internet connection. Please try again when you're back online."
    );
  }

  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const { data: groupData, error: groupError } = await supabase
    .from(tables.GROUPS_TBL)
    .select("admin_id")
    .eq("id", groupId)
    .single();

  if (groupError) {
    throw groupError;
  }

  if (groupData.admin_id !== user.data.user.id) {
    throw new Error("Only the group owner can delete the group");
  }

  const { count: unsettledCount, error: unsettledError } = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId)
    .or("status.eq.pending,status.eq.requested");

  if (unsettledError) throw unsettledError;

  if (unsettledCount && unsettledCount > 0) {
    throw new Error("Settle all expenses before deleting the group.");
  }

  const { data: expenses, error: expensesError } = await supabase
    .from(tables.EXPENSES_TBL)
    .select("id")
    .eq("group_id", groupId);

  if (expensesError) {
    throw expensesError;
  }

  const expenseIds = expenses.map((e) => e.id);

  if (expenseIds.length > 0) {
    const [paymentsRes, payersRes, splitsRes] = await Promise.all([
      supabase
        .from(tables.PAYMENT_SPLITS_TBL)
        .delete()
        .in("expense_id", expenseIds),
      supabase
        .from(tables.EXPENSE_PAYERS_TBL)
        .delete()
        .in("expense_id", expenseIds),
      supabase
        .from(tables.MEMBER_SPLITS_TBL)
        .delete()
        .in("expense_id", expenseIds)
    ]);

    if (paymentsRes.error) throw paymentsRes.error;
    if (payersRes.error) throw payersRes.error;
    if (splitsRes.error) throw splitsRes.error;

    const { error: deleteExpensesError } = await supabase
      .from(tables.EXPENSES_TBL)
      .delete()
      .in("id", expenseIds);

    if (deleteExpensesError) throw deleteExpensesError;
  }

  const { error: membersError } = await supabase
    .from(tables.GROUP_MEMBERS_TBL)
    .delete()
    .eq("group_id", groupId);

  if (membersError) throw membersError;

  const groupResponse = await supabase
    .from(tables.GROUPS_TBL)
    .delete()
    .eq("id", groupId);

  if (groupResponse.error) throw groupResponse.error;

  return {
    success: true,
    message: "Group deleted successfully"
  };
};

export const getGroupsByUserId = async (userId: string) => {
  try {
    const user = await supabase.auth.getUser();

    if (!user.data.user) {
      throw new Error("User not authenticated");
    }

    const { data, error } = await supabase
      .from(tables.GROUP_MEMBERS_TBL)
      .select(
        `${tables.GROUPS_TBL} (
          id,
          created_at,
          last_updated_at,
          name,
          category,
          currency,
          default_expense_currency,
          avatar,
          admin:admin_id (id, email, phone, first_name, last_name, avatar, plan),
          archived,
          expenses:${tables.EXPENSES_TBL}(count)
        )`
      )
      .eq("member_id", userId);

    if (error) {
      throw error;
    }

    const groups = (data as any[])
      .map((item) => {
        const { expenses: expData, ...group } = item[tables.GROUPS_TBL];
        return {
          ...group,
          expense_count: (expData as any[])?.[0]?.count ?? 0
        };
      })
      .filter((group) => group.archived === false)
      .sort(compareGroupsByActivity) as Group[];
    const groupIds = groups.map((g) => g.id);

    const members = await getMembersByGroupIds(groupIds);

    const result = groups.map((group) => ({
      ...group,
      members: members.filter((m) => m.group_id === group.id)
    })) as (Group & { members: Member[] })[];

    // Persist the fresh snapshot so the list is viewable offline.
    cacheService.saveGroupsList(userId, result).catch(() => {});

    return result;
  } catch (error) {
    // Offline / fetch failure — fall back to the last cached snapshot.
    const cached = await cacheService.getGroupsList(userId);
    if (cached) {
      return sortGroupsByActivity((cached as (Group & { members: Member[] })[]).filter(g => !isIndividualGroup(g)));
    }
    throw error;
  }
};

const GROUPS_PAGE_SIZE = 15;

export type GroupFilter = "all" | "created" | "joined" | "archived";

export const getGroupsByUserIdPaginated = async (
  userId: string,
  page: number = 0,
  filter: GroupFilter = "all"
): Promise<{ data: (Group & { members: Member[] })[]; hasNext: boolean }> => {
  try {
    const user = await supabase.auth.getUser();
    if (!user.data.user) throw new Error("User not authenticated");

    const from = page * GROUPS_PAGE_SIZE;
    const to = from + GROUPS_PAGE_SIZE - 1;

    let query = supabase
      .from(tables.GROUPS_TBL)
      .select(
        `id, created_at, last_updated_at, name, category, currency, default_expense_currency, avatar, archived,
         admin:admin_id (id, email, phone, first_name, last_name, avatar, plan),
         ${tables.GROUP_MEMBERS_TBL}!inner(member_id),
         expenses:${tables.EXPENSES_TBL}(count)`,
        { count: "exact" }
      )
      .eq(`${tables.GROUP_MEMBERS_TBL}.member_id`, userId)
      .eq("archived", filter === "archived")
      .order("last_updated_at", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to);

    if (filter === "created") {
      query = query.eq("admin_id", userId);
    } else if (filter === "joined") {
      query = query.neq("admin_id", userId);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    const groups = (data as any[]).map(({ group_members_tbl: _, expenses: expData, ...group }) => ({
      ...group,
      expense_count: (expData as any[])?.[0]?.count ?? 0
    })) as Group[];
    const groupIds = groups.map((g) => g.id);
    const members = groupIds.length ? await getMembersByGroupIds(groupIds) : [];

    const totalPages = Math.ceil((count || 0) / GROUPS_PAGE_SIZE);

    const result = {
      data: groups.map((group) => ({
        ...group,
        members: members.filter((m) => m.group_id === group.id)
      })),
      hasNext: page < totalPages - 1
    };

    // Cache the first "all" page when it's the complete list (no more pages),
    // so the Groups tab is viewable offline. Skip when there are more pages to
    // avoid shrinking a fuller snapshot already cached by the home tab.
    if (page === 0 && filter === "all" && !result.hasNext) {
      cacheService.saveGroupsList(userId, result.data).catch(() => {});
    }

    return result;
  } catch (error) {
    // Offline / fetch failure — serve from the cached snapshot. The cache holds
    // the full non-archived list, so we filter it by tab and return it on the
    // first page (pagination isn't available offline).
    if (page > 0) return { data: [], hasNext: false };

    const cached = (await cacheService.getGroupsList(userId)) as
      | (Group & { members: Member[] })[]
      | null;
    if (!cached) throw error;

    const shared = cached.filter(g => !isIndividualGroup(g));
    let data = shared;
    if (filter === "created") {
      data = shared.filter((g) => g.admin?.id === userId);
    } else if (filter === "joined") {
      data = shared.filter((g) => g.admin?.id !== userId);
    } else if (filter === "archived") {
      // Archived groups aren't cached (the snapshot excludes them).
      data = [];
    }

    return { data: sortGroupsByActivity(data), hasNext: false };
  }
};

/** Paginated Group and Individual entries, optionally restricted to one mode.
 *  The view applies member/owner policies and filters before pagination. */
export const getGroupEntriesByUserIdPaginated = async (
  userId: string,
  page = 0,
  filter: GroupFilter = "all",
  mode?: GroupMode
): Promise<{ data: (Group & { members: Member[] })[]; hasNext: boolean }> => {
  try {
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user?.id !== userId) throw new Error("User not authenticated");
    const from = page * GROUPS_PAGE_SIZE;
    let query = supabase.from("group_entries_v")
      .select("*", { count: "exact" })
      .eq("archived", filter === "archived")
      .order("last_updated_at", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .order("mode", { ascending: true })
      .range(from, from + GROUPS_PAGE_SIZE - 1);
    if (mode) query = query.eq("mode", mode);
    if (filter === "created") query = query.eq("admin_id", userId);
    if (filter === "joined") query = query.neq("admin_id", userId);
    const { data, error, count } = await query;
    if (error) throw error;
    const rawEntries = (data ?? []) as (Group & { individual_ledger?: Book | null })[];
    const entries = rawEntries.map(({ individual_ledger: _, ...entry }) => entry);
    const privateBooks = rawEntries.flatMap(entry => entry.individual_ledger
      ? [{ ...entry.individual_ledger, expense_count: entry.expense_count }] : []);
    const complete = !mode && page === 0 && filter === "all" && from + entries.length >= (count ?? 0);
    const completeBooks = complete || (mode === GroupMode.INDIVIDUAL && page === 0 &&
      filter === "all" && from + entries.length >= (count ?? 0));
    if (privateBooks.length || completeBooks) {
      const cached = (await cacheService.getBooksList(userId).catch(() => null)) as Book[] | null;
      const merged = new Map((completeBooks ? [] : cached ?? []).map(book => [book.id, book]));
      for (const book of privateBooks) merged.set(book.id, book);
      const books = sortGroupsByActivity([...merged.values()]).filter(book => !book.archived);
      states.book.setState(prev => ({ ...prev, list: books, initialized: completeBooks || prev.initialized }));
      await cacheService.saveBooksList(userId, books).catch(() => {});
    }
    const ids = entries.filter(g => !isIndividualGroup(g)).map(g => g.id);
    const members = ids.length ? await getMembersByGroupIds(ids) : [];
    const result = {
      data: entries.map(g => ({
        ...g,
        members: isIndividualGroup(g)
          ? [{ ...g.admin, group_id: g.id, joined_at: g.created_at, role: GroupRole.ADMIN }]
          : members.filter(m => m.group_id === g.id)
      })),
      hasNext: from + entries.length < (count ?? 0)
    };
    if (page === 0 && filter === "all" && !result.hasNext) {
      const cached = mode
        ? await cacheService.getGroupsList(userId).catch(() => null)
        : null;
      const entriesToCache = mode
        ? [...((cached ?? []) as (Group & { members: Member[] })[])
            .filter(entry => (entry.mode ?? GroupMode.GROUP) !== mode), ...result.data]
        : result.data;
      await cacheService.saveGroupsList(userId, sortGroupsByActivity(entriesToCache)).catch(() => {});
    }
    return result;
  } catch (error) {
    if (page > 0) throw error;
    const owner = states.user.getState().details;
    if (owner?.id !== userId) throw error;
    const [groups, books] = await Promise.all([
      cacheService.getGroupsList(userId), cacheService.getBooksList(userId)
    ]);
    if (!groups && !books) throw error;
    const entries = new Map<string, Group & { members: Member[] }>();
    for (const g of (groups ?? []) as (Group & { members: Member[] })[]) {
      if (!isIndividualGroup(g) || g.admin.id === userId) entries.set(`${g.mode ?? GroupMode.GROUP}:${g.id}`, g);
    }
    if (owner?.id === userId) {
      for (const book of (books ?? []) as Book[]) {
        entries.set(`${GroupMode.INDIVIDUAL}:${book.id}`, individualGroupEntry(book, owner));
      }
    }
    const data = sortGroupsByActivity([...entries.values()]).filter(g =>
      (!mode || (g.mode ?? GroupMode.GROUP) === mode) &&
      !g.archived && (filter !== "created" || g.admin.id === userId) &&
      (filter !== "joined" || g.admin.id !== userId)
    );
    return { data: filter === "archived" ? [] : data, hasNext: false };
  }
};

export const getGroupEntriesByUserId = async (userId: string) => {
  const entries: (Group & { members: Member[] })[] = [];
  let page = 0;
  let hasNext = true;
  while (hasNext) {
    const result = await getGroupEntriesByUserIdPaginated(userId, page++, "all");
    entries.push(...result.data);
    hasNext = result.hasNext;
  }
  cacheService.saveGroupsList(userId, entries).catch(() => {});
  const ids = new Set(entries.filter(isIndividualGroup).map(g => g.id));
  const books = await cacheService.getBooksList(userId).catch(() => null);
  states.book.setState(prev => ({
    ...prev,
    list: sortGroupsByActivity(((books ?? prev.list) as Book[]).filter(b => ids.has(b.id) && b.user_id === userId)),
    initialized: true
  }));
  if (books) cacheService.saveBooksList(userId, (books as Book[]).filter(b => ids.has(b.id))).catch(() => {});
  return entries;
};

export const getGroupById = async (groupId: string) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase
    .from(tables.GROUPS_TBL)
    .select(`*, admin:admin_id (id, email, phone, first_name, last_name, avatar, plan)`)
    .eq("id", groupId)
    .single();

  if (error) {
    throw error;
  }

  return data as Group;
};

/**
 * Join a group via its invite token (from a shared link / QR). Adds the current
 * user as a member and claims any phone-contact ghost matching their phone.
 * Returns the joined group's id. Online-only.
 */
export const joinGroupByToken = async (token: string): Promise<string> => {
  const { data, error } = await supabase.rpc("join_group_by_token", {
    _token: token
  });
  if (error) throw error;
  return data as string;
};

/**
 * Rotate a group's invite token (admin only). Generating a fresh token
 * invalidates the old QR/link. `ttlSeconds` sets an expiry that many seconds
 * from now; null/0 means the link never expires. Returns the new token +
 * expiry. Online-only (admin action).
 */
export const resetGroupInvite = async (
  groupId: string,
  ttlSeconds: number | null
): Promise<{ invite_token: string; invite_token_expires_at: string | null }> => {
  const { data, error } = await supabase.rpc("reset_group_invite", {
    _group_id: groupId,
    _ttl_seconds: ttlSeconds
  });
  if (error) throw error;
  // The RPC RETURNS TABLE(...) → a single-row array.
  const row = (Array.isArray(data) ? data[0] : data) as {
    invite_token: string;
    invite_token_expires_at: string | null;
  };
  return {
    invite_token: row.invite_token,
    invite_token_expires_at: row.invite_token_expires_at ?? null
  };
};

export const archiveGroup = async (groupId: string) => {
  // Offline → queue + optimistic cache. The "delete group" action archives.
  if (!(await offlineQueue.isOnline())) {
    const uid = states.user.getState().details?.id;
    if (uid) await offlineQueue.queueSetGroupArchived(uid, groupId, true);
    return { success: true };
  }

  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from(tables.GROUPS_TBL)
    .update({ archived: true })
    .eq("id", groupId)
    .eq("admin_id", user.data.user.id);

  if (error) throw error;
  return { success: true };
};

export const unarchiveGroup = async (groupId: string) => {
  if (!(await offlineQueue.isOnline())) {
    const uid = states.user.getState().details?.id;
    if (uid) await offlineQueue.queueSetGroupArchived(uid, groupId, false);
    return { success: true };
  }

  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from(tables.GROUPS_TBL)
    .update({ archived: false })
    .eq("id", groupId)
    .eq("admin_id", user.data.user.id);

  if (error) throw error;
  return { success: true };
};

export const getActiveAdminGroupsCount = async (userId: string): Promise<number> => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { count, error } = await supabase
    .from(tables.GROUPS_TBL)
    .select("id", { count: "exact", head: true })
    .eq("admin_id", userId)
    .eq("archived", false);

  if (error) throw error;
  return count ?? 0;
};

export const getStatsByGroupId = async (groupId: string) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  // total expenses amount, total paid amount, total owed amount, total members
  // get the total paid from expenses_split_tbl where expense_id in (select id from expenses_tbl where group_id = groupId and status = 'paid') and user_id = currentUserId
  // total expenses from expenses_tbl where group_id = groupId
  const { data, error } = await supabase
    .from(tables.GROUPS_TBL)
    .select(
      `
      id,
      total_expenses: ${tables.EXPENSES_TBL} (
        amount,
        is_draft
      ),
      total_paid: ${tables.MEMBER_SPLITS_TBL} (
        amount,
        expense: ${tables.EXPENSES_TBL} (
          status
        )
      ),
      members: ${tables.GROUP_MEMBERS_TBL} (
        user_id
      )
    `
    )
    .eq("id", groupId)
    .single();

  if (error) {
    throw error;
  }

  // Drafts aren't real shared expenses yet, so they don't count toward the
  // group's total spending.
  const totalExpenses = (data as any).total_expenses.reduce(
    (acc: number, expense: any) =>
      expense.is_draft ? acc : acc + expense.amount,
    0
  );

  const totalPaid = (data as any).total_paid.reduce(
    (acc: number, split: any) => {
      if (split.expense.status === "paid") {
        return acc + split.amount;
      }
      return acc;
    },
    0
  );

  const membersCount = (data as any).members.length;

  return {
    totalExpenses,
    totalPaid,
    totalOwed: totalExpenses - totalPaid,
    membersCount
  };
};
