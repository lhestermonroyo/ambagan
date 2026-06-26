// Supabase Edge Function: send-push
//
// Sends an Expo push notification to a recipient. Reads the recipient's
// push tokens and notification preferences using the SERVICE ROLE, which
// bypasses RLS — so the client never needs read access to other users'
// tokens/preferences.
//
// Deploy:   supabase functions deploy send-push
// Secrets:  SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//           (the first three are injected automatically by Supabase)
//
// Invoked from the app via supabase.functions.invoke("send-push", { body })

import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// Maps NotificationType -> the boolean column in user_preferences_tbl.
const NOTIF_PREF_KEY: Record<string, string> = {
  settlement_request: "notif_settlement_request",
  settlement_approved: "notif_settlement_approved",
  settlement_rejected: "notif_settlement_rejected",
  settlement_reverted: "notif_settlement_rejected",
  settlement_completed: "notif_settlement_completed",
  expense_inclusion: "notif_expense_inclusion",
  group_join: "notif_group_join",
  group_leave: "notif_group_leave",
};

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Verify the caller is a logged-in user (their JWT rides in the header).
    const caller = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user },
    } = await caller.auth.getUser();
    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { toUserId, type, payload } = await req.json();
    const prefKey = NOTIF_PREF_KEY[type];
    if (!toUserId || !prefKey || !payload?.title || !payload?.body) {
      return new Response("Bad request", { status: 400 });
    }

    // Service-role client bypasses RLS to read the recipient's data.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const [{ data: prefs }, { data: tokens }] = await Promise.all([
      admin
        .from("user_preferences_tbl")
        .select(prefKey)
        .eq("user_id", toUserId)
        .maybeSingle(),
      admin
        .from("user_push_tokens_tbl")
        .select("token")
        .eq("user_id", toUserId),
    ]);

    // Respect the recipient's notification preference.
    if (!prefs || !(prefs as Record<string, boolean>)[prefKey]) {
      return new Response(JSON.stringify({ sent: false }), { status: 200 });
    }
    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: false }), { status: 200 });
    }

    const messages = tokens.map((t: { token: string }) => ({
      to: t.token,
      title: payload.title,
      body: payload.body,
      data: { type, referenceId: payload.referenceId, ...payload.data },
      sound: "default",
    }));

    await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(messages),
    });

    return new Response(JSON.stringify({ sent: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
