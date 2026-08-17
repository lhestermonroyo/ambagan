// Entry point for the `refresh-fx-rates` (prod) deployment. All logic lives in
// the shared handler so the `refresh-fx-rates-dev` deployment reuses it
// verbatim; the handler targets the `public`/`dev` schema based on the function
// name at runtime. Invoked weekly by pg_cron (see the refresh-fx-rates cron in
// migrations/2026-08-01_fx_rates.sql).
//
// Deploy: supabase functions deploy refresh-fx-rates
import { handler } from "../_shared/refresh-fx-rates.ts";

Deno.serve(handler);
