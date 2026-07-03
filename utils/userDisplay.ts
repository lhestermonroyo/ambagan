import { UserPreview } from "@/types/user";
import { formatPhoneDisplay } from "./formatPhone";

/**
 * Subtitle for a user list row (shown under their name): their email, or a
 * formatted phone number as a fallback. Phone-contact placeholders have no
 * email until they sign up, so we fall back to the phone we invited them with.
 * Returns "" when neither is available so the row simply shows no subtitle.
 */
export function getUserSubtitle(
  user?: Pick<UserPreview, "email" | "phone"> | null
): string {
  if (user?.email) return user.email;
  if (user?.phone) return formatPhoneDisplay(user.phone);
  return "";
}
