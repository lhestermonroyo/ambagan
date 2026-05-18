import { NotificationType } from "@/types/notifications";
import { UserPreferences } from "@/types/user";
import { tables } from "@/utils/constants";
import { supabase } from "@/utils/supabase";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const NOTIF_PREF_KEY: Record<NotificationType, keyof UserPreferences> = {
  [NotificationType.SETTLEMENT_REQUEST]: "notif_settlement_request",
  [NotificationType.SETTLEMENT_APPROVED]: "notif_settlement_approved",
  [NotificationType.SETTLEMENT_REJECTED]: "notif_settlement_rejected",
  [NotificationType.SETTLEMENT_REVERTED]: "notif_settlement_rejected",
  [NotificationType.SETTLEMENT_COMPLETED]: "notif_settlement_completed",
  [NotificationType.EXPENSE_INCLUSION]: "notif_expense_inclusion",
  [NotificationType.GROUP_JOIN]: "notif_group_join",
  [NotificationType.GROUP_LEAVE]: "notif_group_leave"
};

export async function sendPushNotification(
  toUserId: string,
  type: NotificationType,
  payload: { title: string; body: string; referenceId?: string; data?: Record<string, unknown> }
): Promise<void> {
  const prefKey = NOTIF_PREF_KEY[type];

  const [prefsResult, tokensResult] = await Promise.all([
    supabase
      .from(tables.USER_PREFERENCES_TBL)
      .select(prefKey as string)
      .eq("user_id", toUserId)
      .maybeSingle(),
    supabase
      .from(tables.USER_PUSH_TOKENS_TBL)
      .select("token")
      .eq("user_id", toUserId)
  ]);

  const prefs = prefsResult.data as Record<string, boolean> | null;
  if (!prefs || !prefs[prefKey as string]) return;

  const tokens = tokensResult.data;
  if (!tokens || tokens.length === 0) return;

  const messages = tokens.map((t) => ({
    to: t.token,
    title: payload.title,
    body: payload.body,
    data: { type, referenceId: payload.referenceId, ...payload.data },
    sound: "default"
  }));

  try {
    await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(messages)
    });
  } catch {
    // Silently ignore push delivery failures — notification is best-effort
  }
}
