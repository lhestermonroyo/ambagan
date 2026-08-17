// Entry point for the `scan-receipt-dev` deployment. Logic is shared with
// `scan-receipt` — see ../_shared/scan-receipt.ts. Break this all you want; the
// prod `scan-receipt` deployment is untouched.
//
// Deploy: supabase functions deploy scan-receipt-dev
import { handler } from "../_shared/scan-receipt.ts";

Deno.serve(handler);
