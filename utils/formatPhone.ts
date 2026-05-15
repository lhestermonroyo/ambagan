import { AsYouType, parsePhoneNumberWithError } from "libphonenumber-js";

// Formats a stored PH number for display: "9171234567" → "+63 917 123 4567"
export function formatPhoneDisplay(phone?: string | null): string {
  if (!phone) return "—";
  try {
    const parsed = parsePhoneNumberWithError(phone, "PH");
    return parsed.formatInternational();
  } catch {
    return phone;
  }
}

// Formats digits as the user types inside a +63-prefixed input field
// Strips the leading 0 so the field shows: "917 123 4567"
export function formatPhoneInput(text: string): string {
  const digits = text.replace(/\D/g, "").replace(/^(0|63)/, "");
  return new AsYouType("PH").input(`+63${digits}`).replace(/^\+63\s?/, "");
}

// Strips formatting to get clean digits for storage: "917 123 4567" → "9171234567"
export function parsePhoneInput(text: string): string {
  return text.replace(/\D/g, "").replace(/^(0|63)/, "").slice(0, 10);
}
