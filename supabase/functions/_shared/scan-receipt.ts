// Shared handler for the `scan-receipt` / `scan-receipt-dev` Edge Functions.
//
// Reads a receipt photo and returns the total amount, currency, a short
// description, the merchant, and the receipt date as structured JSON so the
// app can autofill the expense form.
//
// The AI vendor lives ENTIRELY behind this function — the app only ever calls
// `supabase.functions.invoke(edgeFn("scan-receipt"), ...)` and depends on the
// normalized response shape below. This file uses Claude Haiku 4.5 via the
// Anthropic Messages API; swapping it for another vendor later is a change to
// THIS file only, with no app update required, as long as the returned shape
// stays the same.
//
// This function does no table I/O (auth check only), so the schema switch is a
// no-op here — but the `-dev` deployment must exist so dev builds don't 404.
//
// Secrets:  SUPABASE_URL, SUPABASE_ANON_KEY (injected automatically by Supabase)
//           ANTHROPIC_API_KEY — key from https://console.anthropic.com/:
//             supabase secrets set ANTHROPIC_API_KEY=...

import { createClient } from "jsr:@supabase/supabase-js@2";
import { schemaFromRequest } from "./schema.ts";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
const ANTHROPIC_VERSION = "2023-06-01";

// The normalized contract the app depends on. Keep this stable across vendor
// swaps. All fields nullable so a bad/unreadable receipt degrades gracefully.
type ScanResult = {
  amount: string | null;
  currency: string | null;
  description: string | null;
  merchant: string | null;
  date: string | null;
  confidence: number;
};

const EMPTY_RESULT: ScanResult = {
  amount: null,
  currency: null,
  description: null,
  merchant: null,
  date: null,
  confidence: 0
};

const PROMPT =
  "You are reading a photo of a receipt or bill. Extract the final TOTAL " +
  "amount actually paid (after tax/service charge, not the subtotal), the " +
  "ISO 4217 currency code, the merchant/store name, a short human-readable " +
  'description of the purchase (e.g. "Dinner at Jollibee"), and the receipt ' +
  "date. Set confidence between 0 and 1 for how sure you are this is a " +
  "readable receipt. If it is not a receipt or you cannot read it, return " +
  "nulls and confidence 0. Call the record_receipt tool with your answer.";

// A single tool whose input schema IS our result shape. Forcing this tool call
// (tool_choice) makes Claude return strict JSON matching the contract.
const RECEIPT_TOOL = {
  name: "record_receipt",
  description: "Record the fields extracted from the receipt photo.",
  input_schema: {
    type: "object",
    properties: {
      amount: {
        type: ["string", "null"],
        description:
          'Total paid, digits only, e.g. "1250.50". Null if unreadable.'
      },
      currency: {
        type: ["string", "null"],
        description: 'ISO 4217 code, e.g. "PHP". Null if unknown.'
      },
      description: {
        type: ["string", "null"],
        description: "Short human-readable summary of the purchase."
      },
      merchant: {
        type: ["string", "null"],
        description: "Merchant/store name."
      },
      date: {
        type: ["string", "null"],
        description: "Receipt date in ISO 8601 (YYYY-MM-DD) if present."
      },
      confidence: {
        type: "number",
        description: "0–1 confidence this is a readable receipt."
      }
    },
    required: ["confidence"]
  }
};

// Anthropic's image block wants the base64 media type separately. Normalize a
// few common values; default to jpeg.
function normalizeMediaType(mimeType: unknown): string {
  const t = typeof mimeType === "string" ? mimeType.toLowerCase() : "";
  if (t === "image/png" || t === "image/webp" || t === "image/gif") return t;
  return "image/jpeg";
}

// Strip currency symbols, spaces, and thousands separators so the value drops
// straight into the app's AmountInput. Returns null if nothing numeric remains.
function normalizeAmount(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw).replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const num = Number.parseFloat(cleaned);
  if (!Number.isFinite(num)) return null;
  return String(num);
}

export const handler = async (req: Request): Promise<Response> => {
  try {
    // `<name>-dev` deployment → dev schema; `scan-receipt` → public. (No table
    // I/O here, so this only scopes the auth client for consistency.)
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

    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return new Response("Bad request", { status: 400 });
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      console.error("ANTHROPIC_API_KEY not set");
      // Degrade to a blank form rather than surfacing an error to the user.
      return Response.json(EMPTY_RESULT, { status: 200 });
    }

    let aiRes: Response;
    try {
      aiRes = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 1024,
          tools: [RECEIPT_TOOL],
          tool_choice: { type: "tool", name: "record_receipt" },
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: PROMPT },
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: normalizeMediaType(mimeType),
                    data: imageBase64
                  }
                }
              ]
            }
          ]
        })
      });
    } catch (e) {
      console.error(JSON.stringify({ anthropicFetchError: String(e) }));
      return Response.json(EMPTY_RESULT, { status: 200 });
    }

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => "");
      console.error(JSON.stringify({ anthropicStatus: aiRes.status, errText }));
      return Response.json(EMPTY_RESULT, { status: 200 });
    }

    const body = await aiRes.json().catch(() => null);
    // The forced tool call carries the structured JSON in its `input`.
    const toolUse = Array.isArray(body?.content)
      ? body.content.find(
          (block: { type?: string; name?: string }) =>
            block?.type === "tool_use" && block?.name === "record_receipt"
        )
      : null;
    const parsed: Record<string, unknown> | null = toolUse?.input ?? null;

    if (!parsed) {
      console.error(JSON.stringify({ anthropicNoToolUse: body }));
      return Response.json(EMPTY_RESULT, { status: 200 });
    }

    const confidence =
      typeof parsed.confidence === "number"
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0;

    const result: ScanResult = {
      amount: normalizeAmount(parsed.amount),
      currency:
        typeof parsed.currency === "string" && parsed.currency
          ? parsed.currency.toUpperCase()
          : null,
      description:
        typeof parsed.description === "string" && parsed.description
          ? parsed.description
          : null,
      merchant:
        typeof parsed.merchant === "string" && parsed.merchant
          ? parsed.merchant
          : null,
      date: typeof parsed.date === "string" && parsed.date ? parsed.date : null,
      confidence
    };

    return Response.json(result, { status: 200 });
  } catch (e) {
    console.error("Error scanning receipt:", e);
    // Never 500 to the client for a scan — degrade to a blank form.
    return Response.json(EMPTY_RESULT, { status: 200 });
  }
};
