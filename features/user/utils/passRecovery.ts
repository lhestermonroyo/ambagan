/** Only the receipt fields needed for recovery; never persist payment details. */
export type PassTransaction = {
  transactionIdentifier: string;
  productIdentifier: string;
  purchaseDate: string;
};

const PASS_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

/** Replaying the same receipts must produce the same expiry, even on another
 * device. Anchor time to purchases, never to the time Restore was pressed. */
export function recoverPassExpiry(
  transactions: readonly PassTransaction[],
  productIds: ReadonlySet<string>
): string | null {
  const unique = new Map<string, number>();
  for (const transaction of transactions) {
    if (!productIds.has(transaction.productIdentifier)) continue;
    const purchasedAt = Date.parse(transaction.purchaseDate);
    if (!transaction.transactionIdentifier || !Number.isFinite(purchasedAt)) {
      throw new Error("The pass transaction is missing its ID or purchase date");
    }
    const id = JSON.stringify([transaction.productIdentifier, transaction.transactionIdentifier]);
    const previous = unique.get(id);
    if (previous !== undefined && previous !== purchasedAt) {
      throw new Error("Conflicting purchase dates for the same transaction");
    }
    unique.set(id, purchasedAt);
  }

  let expiresAt = 0;
  for (const purchasedAt of [...unique.values()].sort((a, b) => a - b)) {
    expiresAt = Math.max(expiresAt, purchasedAt) + PASS_DURATION_MS;
  }
  return unique.size ? new Date(expiresAt).toISOString() : null;
}

export function latestExpiry(...values: (string | null | undefined)[]): string | null {
  const dates = values.flatMap((value) => {
    const timestamp = value ? Date.parse(value) : NaN;
    return Number.isFinite(timestamp) ? [timestamp] : [];
  });
  return dates.length ? new Date(Math.max(...dates)).toISOString() : null;
}
