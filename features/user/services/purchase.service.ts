import { UserPlan } from "@/types/user";
import { tables } from "@/utils/constants";
import { supabase } from "@/utils/supabase";
import { latestExpiry, recoverPassExpiry } from "@/features/user/utils/passRecovery";
import {
  clearPendingPurchase,
  preparePurchaseRecovery,
  readPassProductIds,
  readPendingPurchase,
  rememberPassProducts,
  rememberPendingPurchase
} from "./purchase-recovery.storage";
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
const purchasesInFlight = new Set<string>();

export class PurchaseActivationPendingError extends Error {
  constructor() {
    super("Your payment was received, but Pro activation is still pending. Retry activation without purchasing again.");
    this.name = "PurchaseActivationPendingError";
  }
}

export const isActivationPending = (error: unknown): boolean =>
  error instanceof PurchaseActivationPendingError;

async function authenticatedPurchaseUser(expectedUserId?: string): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || (expectedUserId && user.id !== expectedUserId)) {
    throw new Error("The signed-in account changed. Sign in to the purchasing account to recover access.");
  }
  if (await Purchases.getAppUserID() !== user.id) {
    throw new Error("Purchase account is not ready. Please sign in again.");
  }
  return user.id;
}

export async function hasPendingPurchase(userId: string): Promise<boolean> {
  return !!(await readPendingPurchase(userId));
}

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
  // Package IDs and store product IDs are different. Remember the real SKUs
  // before a charge, so recovery still works if an offering later changes.
  const all = [offerings.current, ...Object.values(offerings.all ?? {})];
  const ids = all.flatMap((offering) => offering?.availablePackages
    .filter((pkg) => pkg.identifier === TWO_WEEK_PACKAGE_ID)
    .map((pkg) => pkg.product.identifier) ?? []);
  await rememberPassProducts(ids);
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
  const userId = await authenticatedPurchaseUser();
  if (purchasesInFlight.has(userId)) throw new Error("A purchase is already in progress");
  purchasesInFlight.add(userId);
  try {
    if (await readPendingPurchase(userId)) throw new PurchaseActivationPendingError();
    const isPass = pkg.identifier === TWO_WEEK_PACKAGE_ID;
    if (isPass) await rememberPassProducts([pkg.product.identifier]);
    // Check the store as well as the local journal before charging. This covers
    // a process exit immediately after payment, or storage failing after the
    // preflight check but before confirmation could be persisted.
    const existing = await getCustomerInfo();
    let knownProducts = await readPassProductIds();
    if (!knownProducts.size && existing.nonSubscriptionTransactions.length) {
      await getOfferings();
      knownProducts = await readPassProductIds();
    }
    const existingPassExpiry = recoverPassExpiry(existing.nonSubscriptionTransactions, knownProducts);
    const existingEntitlement = existing.entitlements.active[PRO_ENTITLEMENT_ID];
    if (existingEntitlement || (existingPassExpiry && Date.parse(existingPassExpiry) > Date.now())) {
      const receipt = existing.nonSubscriptionTransactions
        .filter((transaction) => knownProducts.has(transaction.productIdentifier))
        .sort((a, b) => Date.parse(b.purchaseDate) - Date.parse(a.purchaseDate))[0];
      await rememberPendingPurchase(userId, {
        id: existingEntitlement
          ? `subscription:${existingEntitlement.productIdentifier}`
          : receipt.transactionIdentifier,
        kind: existingEntitlement ? "subscription" : "pass",
        productIdentifier: existingEntitlement?.productIdentifier ?? receipt.productIdentifier,
        transaction: !existingEntitlement && receipt ? {
          transactionIdentifier: receipt.transactionIdentifier,
          productIdentifier: receipt.productIdentifier,
          purchaseDate: receipt.purchaseDate
        } : null
      });
      throw new PurchaseActivationPendingError();
    }
    await preparePurchaseRecovery(userId);

    const { customerInfo, transaction } = await Purchases.purchasePackage(pkg);
    // The native store transaction ID can differ from RevenueCat's history ID.
    // Only history receipts participate in pass arithmetic. If CustomerInfo is
    // not caught up yet, retain pending activation and refresh it on retry.
    const previousIds = new Set(existing.nonSubscriptionTransactions.map((receipt) => receipt.transactionIdentifier));
    const confirmedPass = isPass ? customerInfo.nonSubscriptionTransactions.find((receipt) =>
      receipt.productIdentifier === pkg.product.identifier && !previousIds.has(receipt.transactionIdentifier)
    ) : undefined;
    // Save confirmation before the separate database call. Recovery belongs to
    // the account that paid, even if the user signs out during the store dialog.
    await rememberPendingPurchase(userId, {
      id: transaction.transactionIdentifier,
      kind: isPass ? "pass" : "subscription",
      productIdentifier: pkg.product.identifier,
      transaction: confirmedPass ? {
        transactionIdentifier: confirmedPass.transactionIdentifier,
        productIdentifier: confirmedPass.productIdentifier,
        purchaseDate: confirmedPass.purchaseDate
      } : null
    });
    return customerInfo;
  } finally {
    purchasesInFlight.delete(userId);
  }
};

export const restorePurchases = async (): Promise<CustomerInfo> => {
  return Purchases.restorePurchases();
};

export const getCustomerInfo = async (): Promise<CustomerInfo> => {
  // A retry should ask RevenueCat again rather than reuse a pre-purchase cache.
  await Purchases.invalidateCustomerInfoCache();
  return Purchases.getCustomerInfo();
};

export const isPurchaseCancelled = (error: unknown): boolean => {
  return (
    (error as PurchasesError)?.code ===
    PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
  );
};

export const isProEntitlementActive = (customerInfo: CustomerInfo): boolean =>
  PRO_ENTITLEMENT_ID in customerInfo.entitlements.active;

/** Reconcile on purchase, restore, launch and reconnect. Transaction history
 * determines pass expiry; repeating a sync cannot grant another fourteen days.
 * Existing saved windows are retained for purchases made before this recovery
 * mechanism shipped. No new database schema or server deployment is required. */
export const syncPlanToSupabase = async (
  customerInfo: CustomerInfo,
  options?: { expectedUserId?: string }
): Promise<{ plan: UserPlan; plan_expires_at: string | null }> => {
  const userId = await authenticatedPurchaseUser(options?.expectedUserId);
  const pending = await readPendingPurchase(userId);
  const productIds = await readPassProductIds();
  if (pending?.kind === "pass") productIds.add(pending.productIdentifier);

  // A fresh install has no local SKU registry. Resolve it from the offering,
  // then reconcile the account's historical receipts, not just new purchases.
  if (!productIds.size && customerInfo.nonSubscriptionTransactions.length) {
    await getOfferings();
    for (const id of await readPassProductIds()) productIds.add(id);
    if (!productIds.size) throw new Error("Pass products are unavailable. Retry activation later.");
  }
  const transactions = [...customerInfo.nonSubscriptionTransactions];
  if (pending?.kind === "pass" && pending.transaction) transactions.push({
    ...pending.transaction,
    purchaseToken: null,
    originalJson: null,
    signature: null
  });
  const passExpiry = recoverPassExpiry(transactions, productIds);
  const entitlement = customerInfo.entitlements.active[PRO_ENTITLEMENT_ID];
  const subscriptionExpiry = entitlement
    ? entitlement.expirationDate ?? customerInfo.latestExpirationDate
    : null;

  // Compare-and-set avoids an older device or a concurrent reconnect overwriting
  // a newer paid window. Each retry re-reads the authoritative user row.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: current, error: readError } = await supabase
      .from(tables.USERS_TBL)
      .select("plan, plan_expires_at")
      .eq("id", userId)
      .single();
    if (readError) throw readError;
    if (!current) throw new Error("Plan sync failed: no matching user row");

    const expiry = latestExpiry(passExpiry, subscriptionExpiry,
      current.plan === "pro" ? current.plan_expires_at : null);
    const unlimited = !!entitlement && !subscriptionExpiry;
    const plan: UserPlan = unlimited || (expiry && Date.parse(expiry) > Date.now()) ? "pro" : "free";
    const plan_expires_at = plan === "pro" && !unlimited ? expiry : null;
    const pendingExpiry = pending?.kind === "pass"
      ? passExpiry
      : pending ? customerInfo.allExpirationDates?.[pending.productIdentifier] : null;
    const pendingExpired = !!pendingExpiry && Date.parse(pendingExpiry) <= Date.now();
    if (pending && !pendingExpired && (plan !== "pro" || (pending.kind === "subscription" && !entitlement))) {
      throw new PurchaseActivationPendingError();
    }

    await authenticatedPurchaseUser(userId);
    let query = supabase.from(tables.USERS_TBL)
      .update({ plan, plan_expires_at }, { count: "exact" })
      .eq("id", userId)
      .eq("plan", current.plan);
    query = current.plan_expires_at === null
      ? query.is("plan_expires_at", null)
      : query.eq("plan_expires_at", current.plan_expires_at);
    const { error, count } = await query;
    if (error) throw error;
    if (!count) continue;

    if (pending) await clearPendingPurchase(userId, pending.id);
    return { plan, plan_expires_at };
  }
  throw new Error("Your access changed while syncing. Retry activation.");
};
