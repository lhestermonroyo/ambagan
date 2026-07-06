import { PaymentStatus } from "@/types/expenses";
import {
  isSettlementNotification,
  Notification,
  NotificationType
} from "@/types/notifications";
import { UserPreview } from "@/types/user";
import { cacheService } from "@/utils/cacheService";
import { tables } from "@/utils/constants";
import { supabase } from "@/utils/supabase";

const USER_FIELDS = "id, email, phone, first_name, last_name, avatar";

/**
 * Resolves the *current* status of the payment_splits referenced by settlement
 * notifications and attaches it as `settlement_status`, so a row reflects the
 * live settlement state instead of the frozen event `type`. Mutates in place.
 * Non-fatal: any failure leaves `settlement_status` undefined (no badge) rather
 * than dropping the already-fetched feed.
 */
const attachSettlementStatuses = async (
  notifications: Notification[]
): Promise<void> => {
  const referenceIds = Array.from(
    new Set(
      notifications
        .filter((n) => isSettlementNotification(n.type))
        .map((n) => n.reference_id)
        .filter(Boolean)
    )
  );

  if (referenceIds.length === 0) return;

  const { data, error } = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select("id, status")
    .in("id", referenceIds);

  if (error || !data) return;

  const statusById = new Map<string, PaymentStatus>(
    data.map((s: any) => [s.id, s.status as PaymentStatus])
  );

  notifications.forEach((n) => {
    if (isSettlementNotification(n.type)) {
      // null (not undefined) marks "resolved but split is gone", so the UI can
      // distinguish it from the offline "not yet resolved" case.
      n.settlement_status = statusById.get(n.reference_id) ?? null;
    }
  });
};

export const getNotificationsByUserId = async (
  userId: string,
  page: number = 0,
  limit: number = 12
) => {
  // Only the first page powers the offline notifications feed (paging back is
  // online-only), mirroring the payments/groups cached-read pattern.
  const canCache = page === 0;

  try {
    const user = await supabase.auth.getUser();

    if (!user.data.user) {
      throw new Error("User not authenticated");
    }

    const from = page * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from(tables.NOTIFICATIONS_TBL)
      .select(
        `id, created_at, type, reference_id, is_read,
        from_user:from_user_id(${USER_FIELDS}),
        to_user:to_user_id(${USER_FIELDS})`,
        { count: "exact" }
      )
      .eq("to_user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / limit);
    const hasNext = page < totalPages - 1;

    const result = {
      data: data as unknown as Notification[],
      pagination: { page, limit, totalCount, hasNext }
    };

    // Resolve live settlement statuses before caching so the offline snapshot
    // carries the same badges. Isolated failure must not drop the feed.
    try {
      await attachSettlementStatuses(result.data);
    } catch {
      // Non-fatal — rows simply render without a status badge.
    }

    // Persist the fresh first page so the list is viewable offline.
    if (canCache) {
      cacheService.saveNotifications(userId, result.data).catch(() => {});
    }

    return result;
  } catch (error) {
    // Offline / fetch failure — hydrate the first page from cache rather than
    // failing to an empty screen. No cached snapshot → surface the error.
    if (canCache) {
      const cached = await cacheService.getNotifications(userId);
      if (cached) {
        return {
          data: cached as Notification[],
          pagination: {
            page,
            limit,
            totalCount: cached.length,
            hasNext: false
          }
        };
      }
    }
    throw error;
  }
};

export const getNotificationById = async (
  id: string
): Promise<Notification | null> => {
  const { data, error } = await supabase
    .from(tables.NOTIFICATIONS_TBL)
    .select(
      `id, created_at, type, reference_id, is_read,
      from_user:from_user_id(${USER_FIELDS}),
      to_user:to_user_id(${USER_FIELDS})`
    )
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as unknown as Notification;
};

export const getUnreadCount = async (userId: string) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const { count, error } = await supabase
    .from(tables.NOTIFICATIONS_TBL)
    .select("id", { count: "exact", head: true })
    .eq("to_user_id", userId)
    .eq("is_read", false);

  if (error) throw error;

  return count ?? 0;
};

export const markNotificationAsRead = async (notificationId: string) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const { error } = await supabase
    .from(tables.NOTIFICATIONS_TBL)
    .update({ is_read: true })
    .eq("id", notificationId);

  if (error) throw error;

  return { success: true };
};

export const markAllNotificationsAsRead = async (userId: string) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const { error } = await supabase
    .from(tables.NOTIFICATIONS_TBL)
    .update({ is_read: true })
    .eq("to_user_id", userId)
    .eq("is_read", false);

  if (error) throw error;

  return { success: true };
};

/**
 * Resolves the "friend" (the other party) and settlement id for a settlement
 * notification from just its payment_split reference. Used by the push-tap
 * handler, which — unlike the in-app list — only has the reference id in its
 * payload and must derive the counterpart to open the friend screen.
 */
export const getSettlementNotificationTarget = async (
  referenceId: string
): Promise<{ friend: UserPreview; settlementId: string } | null> => {
  const { data: userData } = await supabase.auth.getUser();
  const currentUserId = userData.user?.id;
  if (!currentUserId) return null;

  const { data, error } = await supabase
    .from(tables.PAYMENT_SPLITS_TBL)
    .select(
      `id,
      payer:payer_id(${USER_FIELDS}),
      member:member_id(${USER_FIELDS})`
    )
    .eq("id", referenceId)
    .single();

  if (error || !data) return null;

  const payer = data.payer as unknown as UserPreview | null;
  const member = data.member as unknown as UserPreview | null;
  // The friend is whichever party isn't the current user.
  const friend = payer?.id === currentUserId ? member : payer;

  if (!friend?.id) return null;
  return { friend, settlementId: (data as { id: string }).id };
};

export const getNotificationRoute = async (
  type: NotificationType,
  referenceId: string
): Promise<string | null> => {
  try {
    if (isSettlementNotification(type)) {
      const { data, error } = await supabase
        .from(tables.PAYMENT_SPLITS_TBL)
        .select("group_id, expense_id")
        .eq("id", referenceId)
        .single();

      if (error || !data) return null;
      return `/groups/${data.group_id}/${data.expense_id}`;
    }

    if (type === NotificationType.EXPENSE_INCLUSION) {
      const { data, error } = await supabase
        .from(tables.EXPENSES_TBL)
        .select("group_id")
        .eq("id", referenceId)
        .single();

      if (error || !data) return null;
      return `/groups/${data.group_id}/${referenceId}`;
    }

    if (
      type === NotificationType.GROUP_JOIN ||
      type === NotificationType.GROUP_LEAVE
    ) {
      const { data, error } = await supabase
        .from(tables.GROUPS_TBL)
        .select("id")
        .eq("id", referenceId)
        .single();

      if (error || !data) return null;
      return `/groups/${referenceId}`;
    }

    return null;
  } catch {
    return null;
  }
};

export const createNotification = async (payload: {
  fromUserId: string;
  toUserId: string;
  type: NotificationType;
  referenceId: string;
}) => {
  const { fromUserId, toUserId, type, referenceId } = payload;

  const { error } = await supabase.from(tables.NOTIFICATIONS_TBL).insert([
    {
      from_user_id: fromUserId,
      to_user_id: toUserId,
      type,
      reference_id: referenceId
    }
  ]);

  if (error) throw error;

  return { success: true };
};
