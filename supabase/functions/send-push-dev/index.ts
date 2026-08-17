// Entry point for the `send-push-dev` deployment (targets the `dev` schema).
// Logic is shared with `send-push` — see ../_shared/send-push.ts. Break this all
// you want; the prod `send-push` deployment is untouched.
//
// Deploy: supabase functions deploy send-push-dev
import { handler } from "../_shared/send-push.ts";

Deno.serve(handler);
