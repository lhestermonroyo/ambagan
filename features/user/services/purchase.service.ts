import { UserPlan } from "@/types/user";
import { tables } from "@/utils/constants";
import { supabase } from "@/utils/supabase";
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PACKAGE_TYPE,
  PURCHASES_ERROR_CODE,
  PurchasesError,
  PurchasesOffering,
  PurchasesPackage
} from "react-native-purchases";

// Must match the entitlement identifier in your RevenueCat dashboard
const PRO_ENTITLEMENT_ID = "Ambagan Pro";

// The 2-week pass is a CONSUMABLE product (the stores have no 2-week
// auto-renewable duration; non-consumable can only be bought once per customer,
// which would block repurchase for the next trip). It is exposed as a CUSTOM
// package in the RevenueCat offering — its identifier must match the dashboard.
export const TWO_WEEK_PACKAGE_ID = "two_week_v1";
const TWO_WEEK_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

// A consumable pass grants no recurring store entitlement, so we own its access
// window ourselves: plan_expires_at = (later of now / remaining window) + 14d.
// Stacking from any unexpired window means repurchasing early never loses days.
export const computeTwoWeekExpiry = (
  currentExpiresAt?: string | null
): string => {
  const now = Date.now();
  const current = currentExpiresAt ? new Date(currentExpiresAt).getTime() : 0;
  const base = current > now ? current : now;
  return new Date(base + TWO_WEEK_DURATION_MS).toISOString();
};

export const initializePurchases = (userId: string) => {
  const apiKey = __DEV__
    ? process.env.EXPO_PUBLIC_REVENUE_CAT_API_KEY_TEST!
    : process.env.EXPO_PUBLIC_REVENUE_CAT_API_KEY!;

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }
  Purchases.configure({ apiKey, appUserID: userId });
};

export const getOfferings = async (): Promise<PurchasesOffering | null> => {
  const offerings = await Purchases.getOfferings();
  return offerings.current;
};

export const getLifetimePackage = (
  offering: PurchasesOffering
): PurchasesPackage | undefined =>
  offering.availablePackages.find(
    (pkg) => pkg.packageType === PACKAGE_TYPE.LIFETIME
  );

// The 2-week pass has no native PACKAGE_TYPE (no store offers a 2-week
// auto-renewable duration), so it is resolved by its custom package identifier.
export const getTwoWeekPackage = (
  offering: PurchasesOffering
): PurchasesPackage | undefined =>
  offering.availablePackages.find(
    (pkg) => pkg.identifier === TWO_WEEK_PACKAGE_ID
  );

export const getMonthlyPackage = (
  offering: PurchasesOffering
): PurchasesPackage | undefined =>
  offering.availablePackages.find(
    (pkg) => pkg.packageType === PACKAGE_TYPE.MONTHLY
  );

export const getYearlyPackage = (
  offering: PurchasesOffering
): PurchasesPackage | undefined =>
  offering.availablePackages.find(
    (pkg) => pkg.packageType === PACKAGE_TYPE.ANNUAL
  );

export const showManageSubscriptions = async (): Promise<void> => {
  await Purchases.showManageSubscriptions();
};

export const purchasePackage = async (
  pkg: PurchasesPackage
): Promise<CustomerInfo> => {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
};

export const restorePurchases = async (): Promise<CustomerInfo> => {
  return Purchases.restorePurchases();
};

export const getCustomerInfo = async (): Promise<CustomerInfo> => {
  const info = await Purchases.getCustomerInfo();
  console.log("[getCustomerInfo]", JSON.stringify(info, null, 2));
  return info;
};

export const isPurchaseCancelled = (error: unknown): boolean => {
  return (
    (error as PurchasesError)?.code ===
    PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
  );
};

export const isProEntitlementActive = (customerInfo: CustomerInfo): boolean =>
  PRO_ENTITLEMENT_ID in customerInfo.entitlements.active;

/**
 * Reconciles the user's plan with the store and our self-managed window.
 *
 * Resolution order:
 *  1. `setWindowExpiresAt` — an explicit fresh window (use right after buying
 *     the 2-week consumable: `computeTwoWeekExpiry()`). Authoritative for that
 *     purchase even if a store entitlement happens to be active.
 *  2. Active `Ambagan Pro` entitlement (auto-renewable monthly/yearly) — mirror
 *     the entitlement's own `expirationDate`. NOTE: we read the per-entitlement
 *     `expirationDate`, not `customerInfo.latestExpirationDate`, because the
 *     latter is frequently `null` right after a (sandbox) purchase even while
 *     the entitlement is active — that was the "pro but plan_expires_at null" bug.
 *  3. `currentWindowExpiresAt` — a window already stored on the user row (pass
 *     on launch/restore so an unexpired 2-week pass survives the sync).
 *  4. Otherwise → free.
 */
export const syncPlanToSupabase = async (
  customerInfo: CustomerInfo,
  options?: {
    setWindowExpiresAt?: string | null;
    currentWindowExpiresAt?: string | null;
  }
): Promise<{ plan: UserPlan; plan_expires_at: string | null }> => {
  const entitlement = customerInfo.entitlements.active[PRO_ENTITLEMENT_ID];
  const entitlementExpiry =
    entitlement?.expirationDate ?? customerInfo.latestExpirationDate ?? null;

  const setWindow = options?.setWindowExpiresAt ?? null;
  const setWindowValid =
    !!setWindow && new Date(setWindow).getTime() > Date.now();

  const storedWindow = options?.currentWindowExpiresAt ?? null;
  const storedWindowValid =
    !!storedWindow && new Date(storedWindow).getTime() > Date.now();

  let plan: UserPlan;
  let plan_expires_at: string | null;

  if (setWindowValid) {
    // 1. Fresh 2-week pass just purchased — its window is authoritative.
    plan = "pro";
    plan_expires_at = setWindow;
  } else if (entitlement) {
    // 2. Auto-renewable subscription active — mirror its real expiry.
    plan = "pro";
    plan_expires_at = entitlementExpiry;
  } else if (storedWindowValid) {
    // 3. A previously-stamped 2-week window is still running.
    plan = "pro";
    plan_expires_at = storedWindow;
  } else {
    // 4. No active entitlement and no live window.
    plan = "free";
    plan_expires_at = null;
  }

  console.log("[syncPlanToSupabase] Syncing plan to Supabase", {
    plan,
    plan_expires_at,
    entitlementActive: !!entitlement,
    entitlementExpiry,
    latestExpirationDate: customerInfo.latestExpirationDate ?? null,
    setWindow,
    storedWindow
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { error, count } = await supabase
    .from(tables.USERS_TBL)
    .update({ plan, plan_expires_at }, { count: "exact" })
    .eq("id", user.id);

  if (error) throw error;
  if (!count) throw new Error("Plan sync failed: no matching user row updated");

  return { plan, plan_expires_at };
};
