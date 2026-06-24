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

export const getTwoWeekPackage = (
  offering: PurchasesOffering
): PurchasesPackage | undefined =>
  offering.availablePackages.find(
    (pkg) => pkg.packageType === PACKAGE_TYPE.TWO_WEEK
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

export const syncPlanToSupabase = async (
  customerInfo: CustomerInfo
): Promise<{ plan: UserPlan }> => {
  const plan: UserPlan = isProEntitlementActive(customerInfo) ? "pro" : "free";
  const plan_expires_at = customerInfo.latestExpirationDate ?? null;

  console.log("[syncPlanToSupabase] Syncing plan to Supabase", { plan, plan_expires_at });

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

  return { plan };
};
