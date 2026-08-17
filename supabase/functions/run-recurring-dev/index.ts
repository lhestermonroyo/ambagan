// Entry point for the `run-recurring-dev` deployment (targets the `dev` schema).
// Logic is shared with `run-recurring` — see ../_shared/run-recurring.ts. Break
// this all you want; the prod `run-recurring` deployment is untouched. Invoked by
// the dev pg_cron job (which hits this `-dev` URL).
//
// Deploy: supabase functions deploy run-recurring-dev
import { handler } from "../_shared/run-recurring.ts";

Deno.serve(handler);
