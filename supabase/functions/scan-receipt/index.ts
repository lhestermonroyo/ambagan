// Entry point for the `scan-receipt` (prod) deployment. All logic lives in the
// shared handler so the `scan-receipt-dev` deployment reuses it verbatim.
//
// Deploy: supabase functions deploy scan-receipt
import { handler } from "../_shared/scan-receipt.ts";

Deno.serve(handler);
