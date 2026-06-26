import { NotificationType } from "@/types/notifications";
import { supabase } from "@/utils/supabase";

// Push delivery is handled server-side by the `send-push` Edge Function,
// which reads the recipient's tokens + notification preferences using the
// service role. Clients no longer have (and don't need) read access to
// other users' push tokens or preferences — see the RLS section in db.sql.
export async function sendPushNotification(
  toUserId: string,
  type: NotificationType,
  payload: {
    title: string;
    body: string;
    referenceId?: string;
    data?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await supabase.functions.invoke("send-push", {
      body: { toUserId, type, payload }
    });
  } catch {
    // Silently ignore push delivery failures — notification is best-effort
  }
}
