// Shared handler for the `send-push` / `send-push-dev` Edge Functions.
//
// Sends an Expo push notification to a recipient. Reads the recipient's
// push tokens and notification preferences using the SERVICE ROLE, which
// bypasses RLS — so the client never needs read access to other users'
// tokens/preferences.
//
// The target schema (public/dev) is derived from the invoked function name so
// one implementation backs both deployments — see ./schema.ts.
//
// Secrets:  SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//           (all injected automatically by Supabase)
//           EXPO_ACCESS_TOKEN — optional; only needed if "Enhanced push
//           security" is enabled in your Expo account.
//
// Invoked from the app via supabase.functions.invoke(edgeFn("send-push"), { body })

import { createClient } from "jsr:@supabase/supabase-js@2";
import { schemaFromRequest } from "./schema.ts";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// Maps NotificationType -> the boolean column in user_preferences_tbl.
const NOTIF_PREF_KEY: Record<string, string> = {
  settlement_request: "notif_settlement_request",
  settlement_approved: "notif_settlement_approved",
  settlement_rejected: "notif_settlement_rejected",
  settlement_reverted: "notif_settlement_rejected",
  settlement_completed: "notif_settlement_completed",
  expense_inclusion: "notif_expense_inclusion",
  // Both recurring types share one toggle — see the migration
  // 2026-08-02_recurring_notifications.sql for why.
  recurring_posted: "notif_recurring_expense",
  recurring_review: "notif_recurring_expense",
  group_join: "notif_group_join",
  group_leave: "notif_group_leave"
};

export const handler = async (req: Request): Promise<Response> => {
  try {
    // Version marker — if you don't see this in the logs after a test, the
    // dashboard is still running an older deploy of this function.
    console.log("send-push v2 (per-token)");

    // `<name>-dev` deployment → dev schema; `send-push` → public.
    const schema = schemaFromRequest(req);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Verify the caller is a logged-in user (their JWT rides in the header).
    const caller = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { db: { schema }, global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user }
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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { db: { schema } }
    );

    const [{ data: prefs }, { data: tokens }] = await Promise.all([
      admin
        .from("user_preferences_tbl")
        .select(prefKey)
        .eq("user_id", toUserId)
        .maybeSingle(),
      admin.from("user_push_tokens_tbl").select("token").eq("user_id", toUserId)
    ]);

    // Respect the recipient's notification preference.
    if (!prefs || !(prefs as Record<string, boolean>)[prefKey]) {
      console.log(
        JSON.stringify({ skipped: "pref_off_or_missing", toUserId, type })
      );
      return new Response(JSON.stringify({ sent: false, reason: "pref" }), {
        status: 200
      });
    }
    if (!tokens || tokens.length === 0) {
      console.log(JSON.stringify({ skipped: "no_tokens", toUserId, type }));
      return new Response(JSON.stringify({ sent: false, reason: "no_tokens" }), {
        status: 200
      });
    }

    const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(expoAccessToken ? { Authorization: `Bearer ${expoAccessToken}` } : {})
    };

    // Send ONE request per token. Expo rejects a whole request that mixes
    // tokens from different projects/experience IDs
    // (PUSH_TOO_MANY_EXPERIENCE_IDS) — which happens when a user has
    // accumulated tokens across owner/build changes (e.g. @lhestermonroyo vs
    // @lhestermonroyo.dev). Sending per token means one bad/stale token can
    // never block delivery to the others, and lets us prune dead ones.
    const deadTokens: string[] = [];
    const tickets = await Promise.all(
      tokens.map(async (t: { token: string }) => {
        const message = {
          to: t.token,
          title: payload.title,
          body: payload.body,
          data: { type, referenceId: payload.referenceId, ...payload.data },
          sound: "default"
        };

        let body: any = null;
        let httpStatus = 0;
        try {
          const res = await fetch(EXPO_PUSH_URL, {
            method: "POST",
            headers,
            body: JSON.stringify([message])
          });
          httpStatus = res.status;
          body = await res.json().catch(() => null);
        } catch (e) {
          console.error(JSON.stringify({ fetchError: String(e), token: t.token }));
          return { token: t.token, error: String(e) };
        }

        const ticket = Array.isArray(body?.data) ? body.data[0] : body?.data;

        // A 200 does NOT mean delivered — inspect the ticket status. Top-level
        // `errors` (e.g. bad token format) come back outside `data`.
        console.log(
          JSON.stringify({
            token: t.token,
            httpStatus,
            ticket,
            errors: body?.errors
          })
        );

        if (ticket?.status === "error") {
          console.error(
            JSON.stringify({
              pushError: ticket.details?.error ?? "unknown",
              message: ticket.message,
              token: t.token
            })
          );
          // Prune tokens Expo says are gone so they stop failing forever
          // (uninstalled apps, stale dev/simulator or old-project tokens).
          if (ticket.details?.error === "DeviceNotRegistered") {
            deadTokens.push(t.token);
          }
        }

        return { token: t.token, ticket, errors: body?.errors };
      })
    );

    if (deadTokens.length > 0) {
      await admin.from("user_push_tokens_tbl").delete().in("token", deadTokens);
    }

    return new Response(
      JSON.stringify({ sent: true, tickets, prunedTokens: deadTokens.length }),
      { status: 200 }
    );
  } catch (e) {
    console.error("Error sending push notification:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};
