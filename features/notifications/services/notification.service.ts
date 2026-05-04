import { Notification, NotificationType } from "@/types/notifications";
import { tables } from "@/utils/constants";
import { supabase } from "@/utils/supabase";

const USER_FIELDS = "id, email, phone, first_name, last_name, avatar";

export const getNotificationsByUserId = async (userId: string) => {
  const user = await supabase.auth.getUser();

  if (!user.data.user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase
    .from(tables.NOTIFICATIONS_TBL)
    .select(
      `id, created_at, type, reference_id, is_read,
      from_user:from_user_id(${USER_FIELDS}),
      to_user:to_user_id(${USER_FIELDS})`
    )
    .eq("to_user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data as unknown as Notification[];
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

export const getNotificationRoute = async (
  type: NotificationType,
  referenceId: string
): Promise<string | null> => {
  try {
    if (
      type === NotificationType.SETTLEMENT_REQUEST ||
      type === NotificationType.SETTLEMENT_APPROVED ||
      type === NotificationType.SETTLEMENT_REJECTED ||
      type === NotificationType.SETTLEMENT_COMPLETED
    ) {
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
