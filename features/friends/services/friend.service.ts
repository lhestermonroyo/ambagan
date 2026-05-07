import { createNotification } from "@/features/notifications/services/notification.service";
import { FriendSummary, PaymentPreview } from "@/types/expenses";
import { NotificationType } from "@/types/notifications";
import { UserPreview } from "@/types/user";
import { tables } from "@/utils/constants";
import { supabase } from "@/utils/supabase";

export const getFavorites = async (userId: string): Promise<UserPreview[]> => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from(tables.USER_FAVORITES_TBL)
    .select(
      `favorite:favorite_id(id, email, phone, first_name, last_name, avatar)`
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data.map((item) => {
    const fav = Array.isArray(item.favorite) ? item.favorite[0] : item.favorite;
    return fav;
  }) as UserPreview[];
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
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select(
      `amount, member:member_id!inner(id, email, phone, first_name, last_name, avatar), payer:payer_id!inner(id, email, phone, first_name, last_name, avatar), expense:expense_id(currency)`
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
    const expense = Array.isArray(item.expense) ? item.expense[0] : item.expense;
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

  return Object.values(friendMap).map(({ friend, balances }) => ({
    friend,
    balances: Object.entries(balances)
      .map(([currency, amount]) => ({ currency, amount }))
      .sort((a, b) => (a.currency === "PHP" ? -1 : b.currency === "PHP" ? 1 : 0))
  }));
};

export const getFriendSettlements = async (
  userId: string,
  friendId: string
): Promise<PaymentPreview[]> => {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select(
      `id, created_at, group_id, expense_id, member:member_id!inner(id, email, phone, first_name, last_name, avatar), payer:payer_id!inner(id, email, phone, first_name, last_name, avatar), amount, status, expense:expense_id(description, currency)`
    )
    .or(
      `and(member_id.eq.${userId},payer_id.eq.${friendId}),and(member_id.eq.${friendId},payer_id.eq.${userId})`
    )
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data.map((item) => {
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
