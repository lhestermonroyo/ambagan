import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PassTransaction } from "@/features/user/utils/passRecovery";

export type PendingPurchase = {
  id: string;
  kind: "pass" | "subscription";
  productIdentifier: string;
  transaction: PassTransaction | null;
};

const prefix = `@purchase_recovery:${__DEV__ ? "dev" : "prod"}:v1`;
const pendingKey = (userId: string) => `${prefix}:pending:${userId}`;
const productKey = `${prefix}:pass_products`;
const inMemory = new Map<string, PendingPurchase>();

export async function readPendingPurchase(userId: string): Promise<PendingPurchase | null> {
  const current = inMemory.get(userId);
  if (current) return current;
  const raw = await AsyncStorage.getItem(pendingKey(userId));
  if (!raw) return null;
  const value = JSON.parse(raw) as PendingPurchase;
  if (!value.id || !value.productIdentifier || !["pass", "subscription"].includes(value.kind)) {
    throw new Error("Unreadable pending purchase; retry activation before purchasing again");
  }
  inMemory.set(userId, value);
  return value;
}

/** Must succeed BEFORE opening the store purchase dialog. */
export async function preparePurchaseRecovery(userId: string): Promise<void> {
  await AsyncStorage.setItem(pendingKey(userId), "");
}

export async function rememberPendingPurchase(userId: string, pending: PendingPurchase): Promise<void> {
  inMemory.set(userId, pending);
  try {
    await AsyncStorage.setItem(pendingKey(userId), JSON.stringify(pending));
  } catch {
    // A store-confirmed payment must still be applied now. If storage becomes
    // unavailable after preflight, RevenueCat history is the reload fallback.
  }
}

export async function clearPendingPurchase(userId: string, id: string): Promise<void> {
  const pending = await readPendingPurchase(userId);
  if (pending?.id !== id) return;
  // Keep memory intact if removal fails, so another store charge stays blocked.
  await AsyncStorage.removeItem(pendingKey(userId));
  inMemory.delete(userId);
}

export async function readPassProductIds(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(productKey);
  const values: unknown = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(values) || values.some((id) => typeof id !== "string")) {
    throw new Error("Unreadable pass product registry");
  }
  return new Set(values);
}

export async function rememberPassProducts(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const known = await readPassProductIds();
  ids.forEach((id) => known.add(id));
  await AsyncStorage.setItem(productKey, JSON.stringify([...known]));
}
