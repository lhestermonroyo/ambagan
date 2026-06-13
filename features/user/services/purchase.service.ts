import { UserPlan } from "@/types/user";
import { tables } from "@/utils/constants";
import { supabase } from "@/utils/supabase";
import { Linking, Platform } from "react-native";
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

export const getMonthlyPackage = (
  offering: PurchasesOffering
): PurchasesPackage | undefined =>
  offering.availablePackages.find(
    (pkg) => pkg.packageType === PACKAGE_TYPE.MONTHLY
  );

export const getAnnualPackage = (
  offering: PurchasesOffering
): PurchasesPackage | undefined =>
  offering.availablePackages.find(
    (pkg) => pkg.packageType === PACKAGE_TYPE.ANNUAL
  );

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

export const showManageSubscriptions = async (): Promise<void> => {
  try {
    await Purchases.showManageSubscriptions();
  } catch {
    const url =
      Platform.OS === "android"
        ? "https://play.google.com/store/account/subscriptions"
        : "itms-apps://apps.apple.com/account/subscriptions";
    await Linking.openURL(url);
  }
};

export const isPurchaseCancelled = (error: unknown): boolean => {
  return (
    (error as PurchasesError)?.code ===
    PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
  );
};

export const isProEntitlementActive = (customerInfo: CustomerInfo): boolean =>
  PRO_ENTITLEMENT_ID in customerInfo.entitlements.active;

export const getProExpiresAt = (customerInfo: CustomerInfo): string | null =>
  customerInfo.entitlements.active[PRO_ENTITLEMENT_ID]?.expirationDate ?? null;

export const syncPlanToSupabase = async (
  customerInfo: CustomerInfo
): Promise<{ plan: UserPlan; planExpiresAt: string | null }> => {
  const plan: UserPlan = isProEntitlementActive(customerInfo) ? "pro" : "free";
  const planExpiresAt = plan === "pro" ? getProExpiresAt(customerInfo) : null;

  console.log("[syncPlanToSupabase] Syncing plan to Supabase", {
    plan,
    planExpiresAt
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const payload: { plan: UserPlan; plan_expires_at?: string } = { plan };
  if (planExpiresAt !== null) payload.plan_expires_at = planExpiresAt;

  const { error, count } = await supabase
    .from(tables.USERS_TBL)
    .update(payload, { count: "exact" })
    .eq("id", user.id);

  if (error) throw error;
  if (!count) throw new Error("Plan sync failed: no matching user row updated");

  return { plan, planExpiresAt };
};
