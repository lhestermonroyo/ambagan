// Entry point for the `refresh-fx-rates-dev` deployment (targets the `dev`
// schema). Logic is shared with `refresh-fx-rates` — see
// ../_shared/refresh-fx-rates.ts. Break this all you want; the prod
// `refresh-fx-rates` deployment is untouched. Invoked by the dev pg_cron job
// (which hits this `-dev` URL).
//
// Deploy: supabase functions deploy refresh-fx-rates-dev
import { handler } from "../_shared/refresh-fx-rates.ts";

Deno.serve(handler);
