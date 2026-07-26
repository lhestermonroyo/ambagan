// Entry point for the `run-recurring` (prod) deployment. All logic lives in the
// shared handler so the `run-recurring-dev` deployment reuses it verbatim; the
// handler targets the `public`/`dev` schema based on the function name at
// runtime. Invoked on a schedule by pg_cron (see the recurring_expenses cron).
//
// Deploy: supabase functions deploy run-recurring
import { handler } from "../_shared/run-recurring.ts";

Deno.serve(handler);
