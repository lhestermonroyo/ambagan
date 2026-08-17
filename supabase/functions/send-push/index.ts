// Entry point for the `send-push` (prod) deployment. All logic lives in the
// shared handler so the `send-push-dev` deployment reuses it verbatim; the
// handler targets the `public`/`dev` schema based on the function name at
// runtime.
//
// Deploy: supabase functions deploy send-push
import { handler } from "../_shared/send-push.ts";

Deno.serve(handler);
