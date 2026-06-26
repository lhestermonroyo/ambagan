import { createNotification } from "@/features/notifications/services/notification.service";
import { FriendSummary, PaymentPreview } from "@/types/expenses";
import { NotificationType } from "@/types/notifications";
import { UserPreview } from "@/types/user";
import { cacheService } from "@/utils/cacheService";
import { tables } from "@/utils/constants";
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

    const result = data.map((item) => {
      const fav = Array.isArray(item.favorite)
        ? item.favorite[0]
        : item.favorite;
      return fav;
    }) as UserPreview[];

    cacheService.saveFavorites(userId, result).catch(() => {});

    return result;
  } catch (error) {
    const cached = await cacheService.getFavorites(userId);
    if (cached) {
      return cached as UserPreview[];
    }
    throw error;
  }
};

export const addFavorite = async (
  userId: string,
  favoriteId: string
): Promise<void> => {
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
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from(tables.USER_FAVORITES_TBL)
    .delete()
    .eq("user_id", userId)
    .eq("favorite_id", favoriteId);

  if (error) throw error;
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
        `amount, member:member_id!inner(id, email, phone, first_name, last_name, avatar, plan), payer:payer_id!inner(id, email, phone, first_name, last_name, avatar, plan), expense:expense_id(currency)`
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
      const amount = isUserPayer ? item.amount : -item.amount;

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

const FRIEND_SETTLEMENT_FIELDS = `id, created_at, group_id, expense_id, member:member_id!inner(id, email, phone, first_name, last_name, avatar, plan), payer:payer_id!inner(id, email, phone, first_name, last_name, avatar, plan), amount, status, expense:expense_id(description, currency)`;

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
  options: { cutoff?: Date | null; page?: number } = {}
): Promise<{ data: PaymentPreview[]; hasNext: boolean }> => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { cutoff = null, page = 0 } = options;
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

  const { data, error, count } = await query;
  if (error) throw error;

  const totalPages = Math.ceil((count || 0) / FRIEND_SETTLED_PAGE_SIZE);
  return { data: mapFriendPaymentRows(data), hasNext: page < totalPages - 1 };
};

export const bulkSettleWithFriend = async (
  userId: string,
  friendId: string
): Promise<{ success: boolean }> => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { data: splits, error: fetchError } = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select("id, expense_id, member_id, payer_id")
    .eq("payer_id", userId)
    .eq("member_id", friendId)
    .or(`status.eq.pending,status.eq.requested`);

  if (fetchError) throw fetchError;
  if (!splits?.length) return { success: true };

  const { error: updateError } = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .update({ status: "settled", status_updated_at: new Date().toISOString() })
    .in("id", splits.map((s) => s.id));

  if (updateError) throw updateError;

  const uniqueExpenseIds = [...new Set(splits.map((s) => s.expense_id))];
  await Promise.allSettled(
    uniqueExpenseIds.map(async (expenseId) => {
      const { data: allSplits } = await supabase
        .from(tables.PAYMENT_SPLITS_TBL)
        .select("status")
        .eq("expense_id", expenseId);

      if (allSplits?.every((s) => s.status === "settled")) {
        await supabase
          .from(tables.EXPENSES_TBL)
          .update({ status: "completed" })
          .eq("id", expenseId);
      }
    })
  );

  await Promise.allSettled(
    splits.map((s) =>
      createNotification({
        fromUserId: userId,
        toUserId: s.member_id,
        type: NotificationType.SETTLEMENT_COMPLETED,
        referenceId: s.id
      })
    )
  );

  return { success: true };
};

export const bulkRequestSettleWithFriend = async (
  userId: string,
  friendId: string
): Promise<{ success: boolean }> => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { data: splits, error: fetchError } = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select("id, payer_id")
    .eq("member_id", userId)
    .eq("payer_id", friendId)
    .eq("status", "pending");

  if (fetchError) throw fetchError;
  if (!splits?.length) return { success: true };

  const { error: updateError } = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .update({ status: "requested" })
    .in("id", splits.map((s) => s.id));

  if (updateError) throw updateError;

  await Promise.allSettled(
    splits.map((s) =>
      createNotification({
        fromUserId: userId,
        toUserId: s.payer_id,
        type: NotificationType.SETTLEMENT_REQUEST,
        referenceId: s.id
      })
    )
  );

  return { success: true };
};
