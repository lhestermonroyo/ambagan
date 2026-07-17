// Supabase Edge Function: scan-receipt
//
// Reads a receipt photo and returns the total amount, currency, a short
// description, the merchant, and the receipt date as structured JSON so the
// app can autofill the "Custom Expense" form.
//
// The AI vendor lives ENTIRELY behind this function — the app only ever calls
// `supabase.functions.invoke("scan-receipt", ...)` and depends on the
// normalized response shape below. Swapping the beta Gemini Flash call for
// Claude Haiku (or anything else) later is a change to THIS file only, with no
// app update required, as long as the returned shape stays the same.
//
// Deploy:   supabase functions deploy scan-receipt
// Secrets:  SUPABASE_URL, SUPABASE_ANON_KEY (injected automatically by Supabase)
//           GEMINI_API_KEY — free key from Google AI Studio:
//             supabase secrets set GEMINI_API_KEY=...
//
// Invoked from the app via
//   supabase.functions.invoke("scan-receipt", { body: { imageBase64, mimeType } })

import { createClient } from "jsr:@supabase/supabase-js@2";

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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
  "description of the purchase (e.g. \"Dinner at Jollibee\"), and the receipt " +
  "date. Set confidence between 0 and 1 for how sure you are this is a " +
  "readable receipt. If it is not a receipt or you cannot read it, return " +
  "nulls and confidence 0.";

// Ask Gemini for strict JSON matching our shape.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    amount: { type: "string", nullable: true },
    currency: { type: "string", nullable: true },
    description: { type: "string", nullable: true },
    merchant: { type: "string", nullable: true },
    date: { type: "string", nullable: true },
    confidence: { type: "number" }
  },
  required: ["confidence"]
};

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

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Verify the caller is a logged-in user (their JWT rides in the header).
    const caller = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
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

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      console.error("GEMINI_API_KEY not set");
      // Degrade to a blank form rather than surfacing an error to the user.
      return Response.json(EMPTY_RESULT, { status: 200 });
    }

    let geminiRes: Response;
    try {
      geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: PROMPT },
                {
                  inline_data: {
                    mime_type: mimeType || "image/jpeg",
                    data: imageBase64
                  }
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA
          }
        })
      });
    } catch (e) {
      console.error(JSON.stringify({ geminiFetchError: String(e) }));
      return Response.json(EMPTY_RESULT, { status: 200 });
    }

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => "");
      console.error(
        JSON.stringify({ geminiStatus: geminiRes.status, errText })
      );
      return Response.json(EMPTY_RESULT, { status: 200 });
    }

    const body = await geminiRes.json().catch(() => null);
    const text: string | undefined =
      body?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error(JSON.stringify({ geminiNoText: body }));
      return Response.json(EMPTY_RESULT, { status: 200 });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.error(JSON.stringify({ geminiParseError: String(e), text }));
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
      date:
        typeof parsed.date === "string" && parsed.date ? parsed.date : null,
      confidence
    };

    return Response.json(result, { status: 200 });
  } catch (e) {
    console.error("Error scanning receipt:", e);
    // Never 500 to the client for a scan — degrade to a blank form.
    return Response.json(EMPTY_RESULT, { status: 200 });
  }
});
