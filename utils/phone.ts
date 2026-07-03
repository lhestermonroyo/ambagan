/**
 * Normalizes a phone number to E.164 so a phone contact can be matched to a
 * placeholder member and later claimed at signup. Defaults to the Philippines
 * (+63) for local formats (0917…, 917…, 63917…); an explicit country code
 * (leading +) is preserved as-is. Returns null if it can't produce a plausible
 * number — callers should skip contacts with no usable phone.
 */
export function normalizePhone(input?: string | null): string | null {
  if (!input) return null;

  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  if (digits.length < 7) return null; // too short to be a real phone number

  // Explicit international number — keep the country code the user provided.
  if (hasPlus) return "+" + digits;

  // Philippine local formats.
  if (digits.startsWith("0") && digits.length === 11) {
    return "+63" + digits.slice(1); // 09XXXXXXXXX -> +639XXXXXXXXX
  }
  if (digits.startsWith("63") && digits.length === 12) {
    return "+" + digits; // 639XXXXXXXXX -> +639XXXXXXXXX
  }
  if (digits.length === 10 && digits.startsWith("9")) {
    return "+63" + digits; // 9XXXXXXXXX -> +639XXXXXXXXX
  }

  // Fallback: treat as an already-complete international number missing its +.
  return "+" + digits;
}
