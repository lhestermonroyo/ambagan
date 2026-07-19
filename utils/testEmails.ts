/**
 * Test / disposable email domains that should be hidden from user-facing search
 * on production, so real users never stumble onto seed/QA accounts. These stay
 * visible in development (see `shouldHideTestEmails`) so the team can still add
 * them while testing.
 *
 * Keep this list lowercase. `example.*` and `test.com` are RFC-reserved or
 * obviously-fake; the rest are well-known throwaway inbox providers.
 */
export const TEST_EMAIL_DOMAINS = new Set<string>([
  // Obvious / reserved test domains
  "test.com",
  "test.test",
  "example.com",
  "example.org",
  "example.net",
  // Disposable / throwaway inbox providers
  "mailinator.com",
  "yopmail.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "sharklasers.com",
  "grr.la",
  "10minutemail.com",
  "temp-mail.org",
  "tempmail.com",
  "trashmail.com",
  "maildrop.cc",
  "dispostable.com",
  "getnada.com",
  "mailnesia.com",
  "fakeinbox.com",
  "throwawaymail.com",
  "mohmal.com"
]);

/** The domain part of an email, lowercased — or null if it isn't a valid email. */
const domainOf = (email: string | null | undefined): string | null => {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  return email.slice(at + 1).trim().toLowerCase();
};

/** Whether an email belongs to a known test / disposable domain. */
export const isTestEmail = (email: string | null | undefined): boolean => {
  const domain = domainOf(email);
  return domain !== null && TEST_EMAIL_DOMAINS.has(domain);
};

/**
 * Hide test-email accounts everywhere except development builds. `__DEV__` is
 * false in release builds (TestFlight / App Store / Play), matching how the app
 * already switches prod vs. test config elsewhere (e.g. RevenueCat keys).
 */
export const shouldHideTestEmails = (): boolean => !__DEV__;
