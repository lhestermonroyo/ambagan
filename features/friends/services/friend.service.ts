import { v4 as uuid } from "uuid";
import { getRemainingPaymentAmount, usesPartialPaymentFlow } from "@/features/expense/utils/settlementPayments.util";
import { FriendSummary, PaymentExportRow, PaymentPreview } from "@/types/expenses";
import { UserPreview } from "@/types/user";
import { cacheService } from "@/utils/cacheService";
import { tables } from "@/utils/constants";
import * as offlineQueue from "@/utils/offlineQueue";
import { supabase } from "@/utils/supabase";

export const getFavorites = async (userId: string): Promise<UserPreview[]> => {
  try {
    const user = await supabase.auth.getUser();
    if (!user.data.user) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from(tables.USER_FAVORITES_TBL)
      .select(
        `favorite:favorite_id(id, email, phone, first_name, last_name, avatar, plan)`
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const result = data
      .map((item) => {
        const fav = Array.isArray(item.favorite)
          ? item.favorite[0]
          : item.favorite;
        return fav;
      })
      .filter((u): u is UserPreview => Boolean(u?.id));

    cacheService.saveFavorites(userId, result).catch(() => {});

    return result;
  } catch (error) {
    const cached = await cacheService.getFavorites(userId);
    if (cached) {
      return (cached as UserPreview[]).filter((u) => Boolean(u?.id));
    }
    throw error;
  }
};

export const addFavorite = async (
  userId: string,
  favoriteId: string,
  // Passed by the UI so an offline add can be cached as a full favorite row.
  favorite?: UserPreview
): Promise<void> => {
  // Offline → queue + optimistic cache update (coalesces a pending remove).
  if (!(await offlineQueue.isOnline())) {
    await offlineQueue.queueAddFavorite(
      userId,
      favorite ?? ({ id: favoriteId } as UserPreview)
    );
    return;
  }

  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from(tables.USER_FAVORITES_TBL)
    .insert({ user_id: userId, favorite_id: favoriteId });

  if (error) throw error;
};

export const removeFavorite = async (
  userId: string,
  favoriteId: string
): Promise<void> => {
  // Offline → queue + optimistic cache update (coalesces a pending add).
  if (!(await offlineQueue.isOnline())) {
    await offlineQueue.queueRemoveFavorite(userId, favoriteId);
    return;
  }

  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from(tables.USER_FAVORITES_TBL)
    .delete()
    .eq("user_id", userId)
    .eq("favorite_id", favoriteId);

  if (error) throw error;
};

/**
 * Everyone you share a group with, straight from group_members_tbl.
 *
 * The Contacts tab used to be assembled only from favorites, people with an
 * outstanding balance, and the device-local `recentUsers` list — so a co-member
 * appeared only if THIS device happened to write them to AsyncStorage at the
 * moment they were added. Anyone who joined by invite link, was added by another
 * admin, or was added before a reinstall/device switch was invisible. Reading the
 * roster from the server makes the directory durable and device-independent.
 *
 * Placeholder ghosts (phone contacts with no account yet) are included — they're
 * real members of your group, and the row badges them (see FriendRow).
 */
export const getGroupContacts = async (
  userId: string
): Promise<UserPreview[]> => {
  try {
    const user = await supabase.auth.getUser();
    if (!user.data.user) throw new Error("User not authenticated");

    const { data: myGroups, error: groupsError } = await supabase
      .from(tables.GROUP_MEMBERS_TBL)
      .select("group_id")
      .eq("member_id", userId);

    if (groupsError) throw groupsError;

    const groupIds = [...new Set((myGroups ?? []).map((g) => g.group_id))];
    if (groupIds.length === 0) {
      cacheService.saveGroupContacts(userId, []).catch(() => {});
      return [];
    }

    const { data, error } = await supabase
      .from(tables.GROUP_MEMBERS_TBL)
      .select(
        `member:member_id!inner(id, email, phone, first_name, last_name, avatar, plan, is_placeholder)`
      )
      .in("group_id", groupIds)
      .neq("member_id", userId);

    if (error) throw error;

    const byId = new Map<string, UserPreview>();
    (data ?? []).forEach((item) => {
      const member = (
        Array.isArray(item.member) ? item.member[0] : item.member
      ) as UserPreview | undefined;
      if (member?.id && !byId.has(member.id)) byId.set(member.id, member);
    });

    const result = Array.from(byId.values());

    cacheService.saveGroupContacts(userId, result).catch(() => {});

    return result;
  } catch (error) {
    const cached = await cacheService.getGroupContacts(userId);
    if (cached) {
      return (cached as UserPreview[]).filter((u) => Boolean(u?.id));
    }
    throw error;
  }
};

export const getFriendsSummary = async (
  userId: string
): Promise<FriendSummary[]> => {
  try {
    const user = await supabase.auth.getUser();
    if (!user.data.user) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from(tables.PAYMENT_SPLITS_TBL)
      .select(
        `amount, confirmed_paid_amount, member:member_id!inner(id, email, phone, first_name, last_name, avatar, plan), payer:payer_id!inner(id, email, phone, first_name, last_name, avatar, plan), expense:expense_id(currency)`
      )
      .or(`member_id.eq.${userId},payer_id.eq.${userId}`)
      .or(`status.eq.pending,status.eq.requested`);

    if (error) throw error;

    const friendMap: Record<
      string,
      { friend: UserPreview; balances: Record<string, number> }
    > = {};

    data.forEach((item) => {
      const member = Array.isArray(item.member) ? item.member[0] : item.member;
      const payer = Array.isArray(item.payer) ? item.payer[0] : item.payer;
      const expense = Array.isArray(item.expense)
        ? item.expense[0]
        : item.expense;
      const currency = expense?.currency ?? "PHP";

      const isUserPayer = payer.id === userId;
      const other = isUserPayer ? member : payer;
      const remaining = getRemainingPaymentAmount(item);
      const amount = isUserPayer ? remaining : -remaining;

      if (!friendMap[other.id]) {
        friendMap[other.id] = { friend: other, balances: {} };
      }
      friendMap[other.id].balances[currency] =
        (friendMap[other.id].balances[currency] ?? 0) + amount;
    });

    const result = Object.values(friendMap).map(({ friend, balances }) => ({
      friend,
      balances: Object.entries(balances)
        .map(([currency, amount]) => ({ currency, amount }))
        .sort((a, b) =>
          a.currency === "PHP" ? -1 : b.currency === "PHP" ? 1 : 0
        )
    }));

    cacheService.saveFriends(userId, result).catch(() => {});

    return result;
  } catch (error) {
    const cached = await cacheService.getFriends(userId);
    if (cached) {
      return cached as FriendSummary[];
    }
    throw error;
  }
};

const FRIEND_SETTLEMENT_FIELDS = `id, created_at, group_id, expense_id, member:member_id!inner(id, email, phone, first_name, last_name, avatar, plan), payer:payer_id!inner(id, email, phone, first_name, last_name, avatar, plan), amount, confirmed_paid_amount, requested_payment_amount, payment_history_count, has_partial_payments, status, proof_of_payment, member_note, payer_note, status_updated_at, requested_at, settled_at, rejected_at, expense:expense_id(description, currency)`;

const mapFriendPaymentRows = (data: any[]): PaymentPreview[] =>
  data.map((item) => {
    const expense = Array.isArray(item.expense) ? item.expense[0] : item.expense;
    return {
      ...item,
      member: Array.isArray(item.member) ? item.member[0] : item.member,
      payer: Array.isArray(item.payer) ? item.payer[0] : item.payer,
      expense_description: expense?.description ?? null,
      currency: expense?.currency ?? "PHP",
      expense: undefined
    };
  }) as PaymentPreview[];

const FRIEND_PAIR_FILTER = (userId: string, friendId: string) =>
  `and(member_id.eq.${userId},payer_id.eq.${friendId}),and(member_id.eq.${friendId},payer_id.eq.${userId})`;

export const getFriendSettlements = async (
  userId: string,
  friendId: string
): Promise<PaymentPreview[]> => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select(FRIEND_SETTLEMENT_FIELDS)
    .or(FRIEND_PAIR_FILTER(userId, friendId))
    .order("created_at", { ascending: false });

  if (error) throw error;
  return mapFriendPaymentRows(data);
};

export const getActiveFriendSettlements = async (
  userId: string,
  friendId: string
): Promise<PaymentPreview[]> => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select(FRIEND_SETTLEMENT_FIELDS)
    .or(FRIEND_PAIR_FILTER(userId, friendId))
    .in("status", ["pending", "requested"])
    .order("created_at", { ascending: false });

  if (error) throw error;
  return mapFriendPaymentRows(data);
};

const FRIEND_SETTLED_PAGE_SIZE = 20;

export const getSettledFriendSettlements = async (
  userId: string,
  friendId: string,
  options: { cutoff?: Date | null; until?: Date | null; page?: number } = {}
): Promise<{ data: PaymentPreview[]; hasNext: boolean }> => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { cutoff = null, until = null, page = 0 } = options;
  const from = page * FRIEND_SETTLED_PAGE_SIZE;
  const to = from + FRIEND_SETTLED_PAGE_SIZE - 1;

  let query = supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select(FRIEND_SETTLEMENT_FIELDS, { count: "exact" })
    .or(FRIEND_PAIR_FILTER(userId, friendId))
    .eq("status", "settled")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (cutoff) query = query.gte("created_at", cutoff.toISOString());
  if (until) query = query.lte("created_at", until.toISOString());

  const { data, error, count } = await query;
  if (error) throw error;

  const totalPages = Math.ceil((count || 0) / FRIEND_SETTLED_PAGE_SIZE);
  return { data: mapFriendPaymentRows(data), hasNext: page < totalPages - 1 };
};

// Export needs the parent expense's category + own date on top of the standard
// payment fields so each CSV row is self-describing (mirrors the group export).
const FRIEND_EXPORT_FIELDS = `id, created_at, group_id, expense_id, member:member_id!inner(id, email, phone, first_name, last_name, avatar, plan), payer:payer_id!inner(id, email, phone, first_name, last_name, avatar, plan), amount, confirmed_paid_amount, requested_payment_amount, payment_history_count, has_partial_payments, status, proof_of_payment, member_note, payer_note, status_updated_at, requested_at, settled_at, rejected_at, expense:expense_id(description, currency, category, expense_date), payment_history:settlement_payments_tbl(*)`;

const mapFriendExportRows = (data: any[]): PaymentExportRow[] =>
  data.map((item) => {
    const expense = Array.isArray(item.expense) ? item.expense[0] : item.expense;
    return {
      ...item,
      member: Array.isArray(item.member) ? item.member[0] : item.member,
      payer: Array.isArray(item.payer) ? item.payer[0] : item.payer,
      expense_description: expense?.description ?? null,
      currency: expense?.currency ?? "PHP",
      expense_category: expense?.category ?? "other",
      expense_date: expense?.expense_date ?? null,
      expense: undefined
    };
  }) as PaymentExportRow[];

export const getFriendPaymentsForExport = async (
  userId: string,
  friendId: string,
  cutoff: Date | null,
  until: Date | null = null
): Promise<PaymentExportRow[]> => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  let query = supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select(FRIEND_EXPORT_FIELDS)
    .or(FRIEND_PAIR_FILTER(userId, friendId))
    .order("created_at", { ascending: false });

  if (cutoff) query = query.gte("created_at", cutoff.toISOString());
  if (until) query = query.lte("created_at", until.toISOString());

  const { data, error } = await query;
  if (error) throw error;
  return mapFriendExportRows(data);
};


async function updateFriendBalances(userId: string, friendId: string, received: boolean) {
  const auth = await supabase.auth.getUser();
  if (!auth.data.user || auth.data.user.id !== userId) throw new Error("Sign in to update these payments.");
  const { data: rows, error } = await supabase.from(tables.PAYMENT_SPLITS_TBL)
    .select("id, amount, confirmed_paid_amount, requested_payment_amount, has_partial_payments")
    .eq(received ? "payer_id" : "member_id", userId)
    .eq(received ? "member_id" : "payer_id", friendId)
    .in("status", received ? ["pending", "requested"] : ["pending"]);
  if (error) throw error;
  const eligible = received ? rows?.filter((row) => !usesPartialPaymentFlow(row)) : rows;
  if (!eligible?.length) return { success: true };
  const result = await supabase.rpc("settle_friend_balances", {
    p_friend_id: friendId, p_received: received,
    p_rows: eligible.map((row) => ({ settlement_id: row.id, payment_id: uuid(), remaining_amount: getRemainingPaymentAmount(row) }))
  });
  if (result.error) throw result.error;
  return { success: true };
}

export const bulkSettleWithFriend = (userId: string, friendId: string) => updateFriendBalances(userId, friendId, true);
export const bulkRequestSettleWithFriend = (userId: string, friendId: string) => updateFriendBalances(userId, friendId, false);
