import states from "@/states";
import {
  ExpensePayer,
  ExpensePreview,
  Payment,
  PaymentPreview,
  PaymentStatus
} from "@/types/expenses";
import { Book, PersonalBookTotal, PersonalExpense } from "@/types/books";
import { Group, Member } from "@/types/groups";
import { UserPreview } from "@/types/user";
import NetInfo from "@react-native-community/netinfo";
import "react-native-get-random-values";
import { v4 as uuid } from "uuid";
import { cacheService } from "./cacheService";
import { getDb } from "./offlineDb";

/**
 * Arguments forwarded verbatim to `services.expense.saveExpense` on sync.
 */
export type AddExpenseArgs = {
  expensePayload: {
    amount: number;
    description: string;
    proof_of_payment: null;
    group_id: string;
    split_type: string;
    currency: string;
    category?: string;
    expense_date?: string;
    id?: string;
  };
  payers: { userId: string; amount: number }[];
  memberSplits: { userId: string; amount: number; percentage: number }[];
  paymentSplits: { memberSplitId: string; payerId: string; amount: number }[];
};

/**
 * Arguments forwarded verbatim to `services.expense.saveDraftExpense` on sync.
 * A draft has no payers/splits, so only the expense payload is queued.
 */
export type CreateDraftArgs = {
  expensePayload: {
    amount: number;
    description: string;
    proof_of_payment: null;
    group_id: string;
    currency: string;
    category?: string;
    expense_date?: string;
    id?: string;
  };
};

/**
 * Arguments forwarded verbatim to `services.expense.updateExpense` on sync.
 * Offline edits can't pick a new image (uploads are blocked offline), so the
 * proof is only ever an existing URL string or null.
 */
export type UpdateExpenseArgs = {
  expensePayload: {
    amount: number;
    description: string;
    proof_of_payment: string | null;
    group_id: string;
    split_type: string;
    currency: string;
    category?: string;
    expense_date?: string;
  };
  payers: { userId: string; amount: number }[];
  memberSplits: { userId: string; amount: number; percentage: number }[];
  paymentSplits: { memberSplitId: string; payerId: string; amount: number }[];
};

/**
 * Arguments forwarded verbatim to `services.group.saveGroup` on sync.
 */
export type CreateGroupArgs = {
  name: string;
  category: string;
  currency: string;
  avatar: null;
  admin_id: string;
  member_ids: string[];
  id?: string;
};

/**
 * Arguments forwarded verbatim to `services.group.updateGroup` on sync.
 * Avatar is always null offline (image uploads are blocked offline).
 */
export type UpdateGroupArgs = {
  name: string;
  category: string;
  currency: string;
  avatar: null;
};

export type QueueOpType =
  | "ADD_EXPENSE"
  | "CREATE_DRAFT"
  | "UPDATE_EXPENSE"
  | "DELETE_EXPENSE"
  | "CREATE_GROUP"
  | "UPDATE_GROUP"
  | "SET_GROUP_ARCHIVED"
  | "ADD_FAVORITE"
  | "REMOVE_FAVORITE"
  | "UPDATE_PREFERENCES"
  | "UPDATE_MEMBERS"
  | "CREATE_BOOK"
  | "UPDATE_BOOK"
  | "SET_BOOK_ARCHIVED"
  | "ADD_PERSONAL_EXPENSE"
  | "UPDATE_PERSONAL_EXPENSE"
  | "DELETE_PERSONAL_EXPENSE"
  | "TOGGLE_PERSONAL_EXPENSE_STATUS";

/**
 * A local receipt image captured/attached while offline. The file can't be
 * uploaded until we reconnect, so we stash its on-device uri (+ filename) and
 * re-upload it best-effort once the expense itself has synced.
 */
export type ProofUpload = {
  uri: string;
  fileName: string | null;
};

export type AddExpensePayload = {
  clientId: string;
  groupId: string;
  args: AddExpenseArgs;
  /** Optimistic settlements injected offline; cleared on sync. */
  optimisticPayments?: Payment[];
  /** Local receipt image to re-upload after the expense syncs, if any. */
  proofUpload?: ProofUpload;
};

export type CreateDraftPayload = {
  clientId: string;
  groupId: string;
  args: CreateDraftArgs;
  /** Local receipt image to re-upload after the draft syncs, if any. */
  proofUpload?: ProofUpload;
};

export type UpdateExpensePayload = {
  clientId: string;
  groupId: string;
  expenseId: string;
  args: UpdateExpenseArgs;
};

export type DeleteExpensePayload = {
  groupId: string;
  expenseId: string;
};

export type CreateGroupPayload = {
  clientId: string;
  userId: string;
  args: CreateGroupArgs;
};

export type UpdateGroupPayload = {
  groupId: string;
  args: UpdateGroupArgs;
};

export type SetGroupArchivedPayload = {
  groupId: string;
  archived: boolean;
};

export type FavoritePayload = {
  userId: string;
  favoriteId: string;
};

export type UpdatePreferencesPayload = {
  userId: string;
  prefs: Record<string, any>;
};

export type UpdateMembersPayload = {
  groupId: string;
  membersToAdd: string[];
  membersToRemove: string[];
};

// ---------------------------------------------------------------------------
// Personal "Books" feature — args forwarded verbatim to the book services on
// sync. Image uploads are blocked offline, so avatars/receipts are always null.
// ---------------------------------------------------------------------------

export type CreateBookArgs = {
  name: string;
  category: string;
  currency: string;
  avatar: null;
  user_id: string;
  id?: string;
};

export type CreateBookPayload = {
  clientId: string;
  userId: string;
  args: CreateBookArgs;
};

export type UpdateBookArgs = {
  name: string;
  category: string;
  currency: string;
  avatar: null;
};

export type UpdateBookPayload = {
  bookId: string;
  args: UpdateBookArgs;
};

export type SetBookArchivedPayload = {
  bookId: string;
  archived: boolean;
};

export type AddPersonalExpenseArgs = {
  book_id: string;
  user_id: string;
  amount: number;
  description: string;
  category: string;
  currency: string;
  expense_date?: string;
  proof_of_payment: null;
  status?: "paid" | "pending";
  id?: string;
};

export type AddPersonalExpensePayload = {
  clientId: string;
  bookId: string;
  args: AddPersonalExpenseArgs;
  /** Local receipt image to re-upload after the expense syncs, if any. */
  proofUpload?: ProofUpload;
};

export type UpdatePersonalExpenseArgs = {
  amount: number;
  description: string;
  category: string;
  currency: string;
  expense_date?: string;
  proof_of_payment: null;
  existing_proof_url: string | null;
  status?: "paid" | "pending";
};

export type UpdatePersonalExpensePayload = {
  bookId: string;
  expenseId: string;
  args: UpdatePersonalExpenseArgs;
  /** Local receipt image to re-upload after the edit syncs, if any. */
  proofUpload?: ProofUpload;
};

export type DeletePersonalExpensePayload = {
  bookId: string;
  expenseId: string;
};

export type TogglePersonalExpenseStatusPayload = {
  bookId: string;
  expenseId: string;
  status: "paid" | "pending";
};

export type QueuedOp =
  | {
      id: string;
      type: "ADD_EXPENSE";
      payload: AddExpensePayload;
      status: "pending" | "failed" | "dead";
      attempts: number;
      created_at: number;
    }
  | {
      id: string;
      type: "CREATE_DRAFT";
      payload: CreateDraftPayload;
      status: "pending" | "failed" | "dead";
      attempts: number;
      created_at: number;
    }
  | {
      id: string;
      type: "UPDATE_EXPENSE";
      payload: UpdateExpensePayload;
      status: "pending" | "failed" | "dead";
      attempts: number;
      created_at: number;
    }
  | {
      id: string;
      type: "DELETE_EXPENSE";
      payload: DeleteExpensePayload;
      status: "pending" | "failed" | "dead";
      attempts: number;
      created_at: number;
    }
  | {
      id: string;
      type: "CREATE_GROUP";
      payload: CreateGroupPayload;
      status: "pending" | "failed" | "dead";
      attempts: number;
      created_at: number;
    }
  | {
      id: string;
      type: "UPDATE_GROUP";
      payload: UpdateGroupPayload;
      status: "pending" | "failed" | "dead";
      attempts: number;
      created_at: number;
    }
  | {
      id: string;
      type: "SET_GROUP_ARCHIVED";
      payload: SetGroupArchivedPayload;
      status: "pending" | "failed" | "dead";
      attempts: number;
      created_at: number;
    }
  | {
      id: string;
      type: "ADD_FAVORITE";
      payload: FavoritePayload;
      status: "pending" | "failed" | "dead";
      attempts: number;
      created_at: number;
    }
  | {
      id: string;
      type: "REMOVE_FAVORITE";
      payload: FavoritePayload;
      status: "pending" | "failed" | "dead";
      attempts: number;
      created_at: number;
    }
  | {
      id: string;
      type: "UPDATE_PREFERENCES";
      payload: UpdatePreferencesPayload;
      status: "pending" | "failed" | "dead";
      attempts: number;
      created_at: number;
    }
  | {
      id: string;
      type: "UPDATE_MEMBERS";
      payload: UpdateMembersPayload;
      status: "pending" | "failed" | "dead";
      attempts: number;
      created_at: number;
    }
  | {
      id: string;
      type: "CREATE_BOOK";
      payload: CreateBookPayload;
      status: "pending" | "failed" | "dead";
      attempts: number;
      created_at: number;
    }
  | {
      id: string;
      type: "UPDATE_BOOK";
      payload: UpdateBookPayload;
      status: "pending" | "failed" | "dead";
      attempts: number;
      created_at: number;
    }
  | {
      id: string;
      type: "SET_BOOK_ARCHIVED";
      payload: SetBookArchivedPayload;
      status: "pending" | "failed" | "dead";
      attempts: number;
      created_at: number;
    }
  | {
      id: string;
      type: "ADD_PERSONAL_EXPENSE";
      payload: AddPersonalExpensePayload;
      status: "pending" | "failed" | "dead";
      attempts: number;
      created_at: number;
    }
  | {
      id: string;
      type: "UPDATE_PERSONAL_EXPENSE";
      payload: UpdatePersonalExpensePayload;
      status: "pending" | "failed" | "dead";
      attempts: number;
      created_at: number;
    }
  | {
      id: string;
      type: "DELETE_PERSONAL_EXPENSE";
      payload: DeletePersonalExpensePayload;
      status: "pending" | "failed" | "dead";
      attempts: number;
      created_at: number;
    }
  | {
      id: string;
      type: "TOGGLE_PERSONAL_EXPENSE_STATUS";
      payload: TogglePersonalExpenseStatusPayload;
      status: "pending" | "failed" | "dead";
      attempts: number;
      created_at: number;
    };

export async function isOnline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected ?? true;
  } catch {
    // If we can't determine connectivity, assume online so we don't
    // accidentally route everything through the offline queue.
    return true;
  }
}

// ---------------------------------------------------------------------------
// Queue primitives
// ---------------------------------------------------------------------------

async function enqueue(type: QueueOpType, payload: object): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.runAsync(
    "INSERT INTO pending_queue (id, type, payload, status, created_at) VALUES (?, ?, ?, 'pending', ?)",
    [id, type, JSON.stringify(payload), Date.now()]
  );
  return id;
}

export async function getQueue(): Promise<QueuedOp[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    type: string;
    payload: string;
    status: string;
    attempts: number | null;
    created_at: number;
  }>("SELECT * FROM pending_queue ORDER BY created_at ASC");

  return rows.map(
    (r) =>
      ({
        id: r.id,
        type: r.type as QueueOpType,
        payload: JSON.parse(r.payload),
        status: r.status as "pending" | "failed" | "dead",
        attempts: r.attempts ?? 0,
        created_at: r.created_at
      }) as QueuedOp
  );
}

export async function removeFromQueue(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM pending_queue WHERE id = ?", [id]);
}

/** Overwrite a queued op's payload in place — used to coalesce an edit into a
 * still-pending create so only one operation ever reaches the server. */
async function updateQueuePayload(id: string, payload: object): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE pending_queue SET payload = ? WHERE id = ?", [
    JSON.stringify(payload),
    id
  ]);
}

/** The still-pending create op for an expense id (ADD_EXPENSE or CREATE_DRAFT),
 * if any — the anchor for edit/delete coalescing. */
async function findPendingExpenseCreate(
  expenseId: string
): Promise<QueuedOp | undefined> {
  const ops = await getQueue();
  return ops.find(
    (o) =>
      o.status === "pending" &&
      (o.type === "ADD_EXPENSE" || o.type === "CREATE_DRAFT") &&
      o.payload.clientId === expenseId
  );
}

/** A still-pending favorite op (ADD or REMOVE) for the same target, if any. */
async function findPendingFavorite(
  type: "ADD_FAVORITE" | "REMOVE_FAVORITE",
  userId: string,
  favoriteId: string
): Promise<QueuedOp | undefined> {
  const ops = await getQueue();
  return ops.find((o) => {
    if (o.status !== "pending" || o.type !== type) return false;
    const p = o.payload as FavoritePayload;
    return p.userId === userId && p.favoriteId === favoriteId;
  });
}

/**
 * After this many failed sync attempts (across reconnects/foregrounds) an op is
 * dead-lettered: left in the queue but no longer retried, so a permanently
 * rejected write (e.g. an RLS conflict) stops re-firing the "didn't sync" toast
 * on every reconnect forever. Genuinely transient failures almost never reach
 * this many distinct attempts.
 */
export const MAX_SYNC_ATTEMPTS = 5;

/**
 * Record a failed sync attempt: bump the attempt counter and set the op's status
 * to `dead` once it exceeds MAX_SYNC_ATTEMPTS, otherwise `failed` (still
 * retried). Returns the resulting status so the caller can distinguish a
 * transient failure (will retry) from a dead-lettered one (won't).
 */
export async function markFailed(id: string): Promise<"failed" | "dead"> {
  const db = await getDb();
  await db.runAsync(
    "UPDATE pending_queue SET attempts = attempts + 1 WHERE id = ?",
    [id]
  );
  const row = await db.getFirstAsync<{ attempts: number }>(
    "SELECT attempts FROM pending_queue WHERE id = ?",
    [id]
  );
  const status = (row?.attempts ?? 0) >= MAX_SYNC_ATTEMPTS ? "dead" : "failed";
  await db.runAsync("UPDATE pending_queue SET status = ? WHERE id = ?", [
    status,
    id
  ]);
  return status;
}

export async function getPendingCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) as c FROM pending_queue WHERE status = 'pending'"
  );
  return row?.c ?? 0;
}

/**
 * How many expense-creating ops (ADD_EXPENSE) are queued for today (local time),
 * pending or failed. Added to the last-known server count to keep the free-tier
 * daily limit enforced while offline — a failed op still consumed a slot on the
 * server's append-only creation log once it eventually syncs. Drafts don't count
 * (draft creation is Pro-only, and the limit only applies to free users).
 */
export async function countExpensesQueuedToday(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) as c FROM pending_queue WHERE type = 'ADD_EXPENSE' AND created_at >= ?",
    [startOfDay.getTime()]
  );
  return row?.c ?? 0;
}

/**
 * How many personal-expense-creating ops (ADD_PERSONAL_EXPENSE) are queued for
 * today — the offline counterpart to the group `countExpensesQueuedToday`, kept
 * as a SEPARATE bucket so the personal 5/day limit stays enforced offline.
 */
export async function countPersonalExpensesQueuedToday(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) as c FROM pending_queue WHERE type = 'ADD_PERSONAL_EXPENSE' AND created_at >= ?",
    [startOfDay.getTime()]
  );
  return row?.c ?? 0;
}

// ---------------------------------------------------------------------------
// Optimistic injection — keep live Zustand state and the SQLite cache in sync
// so a queued item shows up immediately and survives an app restart.
// ---------------------------------------------------------------------------

async function injectPendingExpense(groupId: string, expense: ExpensePreview) {
  // Update both the group detail expenseList (if open) and the group list
  // expense_count in a single setState call.
  states.group.setState((prev) => ({
    ...prev,
    expenseList:
      prev.details?.id === groupId
        ? [expense, ...prev.expenseList]
        : prev.expenseList,
    list: prev.list.map((g) =>
      g.id === groupId
        ? { ...g, expense_count: (g.expense_count ?? 0) + 1 }
        : g
    )
  }));

  // Cache snapshot — group detail so re-opening while offline still shows it.
  try {
    const cached = await cacheService.getGroupDetail(groupId);
    if (cached) {
      await cacheService.saveGroupDetail(
        groupId,
        [expense, ...cached.expenseList],
        cached.memberList
      );
    }
  } catch {
    // best-effort
  }

  // Cache snapshot — groups list so GroupItem shows updated expense_count.
  const userId = states.user.getState().details?.id;
  if (userId) {
    try {
      const cachedList = await cacheService.getGroupsList(userId);
      if (cachedList) {
        await cacheService.saveGroupsList(
          userId,
          (cachedList as any[]).map((g: any) =>
            g.id === groupId
              ? { ...g, expense_count: (g.expense_count ?? 0) + 1 }
              : g
          )
        );
      }
    } catch {
      // best-effort
    }
  }
}

async function clearPendingExpense(groupId: string, clientId: string) {
  const unmark = (e: ExpensePreview) =>
    e.id === clientId ? { ...e, pending: false } : e;

  if (states.group.getState().details?.id === groupId) {
    states.group.setState((prev) => ({
      ...prev,
      expenseList: prev.expenseList.map(unmark)
    }));
  }

  try {
    const cached = await cacheService.getGroupDetail(groupId);
    if (cached) {
      await cacheService.saveGroupDetail(
        groupId,
        cached.expenseList.map(unmark),
        cached.memberList
      );
    }
  } catch {
    // best-effort
  }
}

/**
 * Inject the optimistic settlements generated by an offline expense into the
 * group's settlement cache + live state, and into each involved friend's
 * settlement cache, so they show up (flagged pending) wherever settlements are
 * viewed offline.
 */
async function injectPendingPayments(
  groupId: string,
  payments: Payment[],
  userId: string | undefined
) {
  if (payments.length === 0 || !userId) return;

  // The group + friend settlement views only show rows the user is part of —
  // mirror that filter (an expense can be recorded between two other members).
  const userPayments = payments.filter(
    (p) => p.member.id === userId || p.payer.id === userId
  );
  if (userPayments.length === 0) return;

  // Group settlements — cache (active list) + live state if loaded.
  try {
    const cached = await cacheService.getGroupSettlements(groupId);
    await cacheService.saveGroupSettlements(
      groupId,
      [...userPayments, ...(cached?.active ?? [])],
      cached?.settled ?? []
    );
  } catch {
    // best-effort
  }

  // Bump the refresh token so a mounted Settlements tab refetches (offline it
  // re-hydrates from the cache we just updated above).
  states.group.setState((prev) => ({
    ...prev,
    settlementList:
      prev.details?.id === groupId
        ? [...userPayments, ...prev.settlementList]
        : prev.settlementList,
    settlementRefreshToken: prev.settlementRefreshToken + 1
  }));

  // Prepend into the home tab's activityList so Recent Activities reflects it.
  states.expense.setState((prev) => ({
    ...prev,
    activityList: [
      ...(userPayments as unknown as PaymentPreview[]),
      ...prev.activityList
    ]
  }));

  // Friend settlements — append to the "other participant" friend's cache for
  // every payment the current user is part of.
  for (const p of userPayments) {
    const friendId =
      p.member.id === userId
        ? p.payer.id
        : p.payer.id === userId
          ? p.member.id
          : null;
    if (!friendId) continue;
    try {
      const fcached = await cacheService.getFriendSettlements(friendId);
      await cacheService.saveFriendSettlements(
        friendId,
        [p, ...(fcached?.active ?? [])],
        fcached?.settled ?? []
      );
    } catch {
      // best-effort
    }
  }
}

/**
 * Remove the optimistic settlements for a synced expense from the group + friend
 * settlement caches (the server's real splits replace them on the next online
 * fetch). Keeps offline-cached snapshots from duplicating after a sync.
 */
async function clearPendingPaymentsForExpense(
  groupId: string,
  payments: Payment[],
  userId: string | undefined
) {
  const ids = new Set(payments.map((p) => p.id));
  const keep = (p: Payment) => !ids.has(p.id);

  // Group settlements — cache + live state.
  try {
    const cached = await cacheService.getGroupSettlements(groupId);
    if (cached) {
      await cacheService.saveGroupSettlements(
        groupId,
        (cached.active as Payment[]).filter(keep),
        cached.settled
      );
    }
  } catch {
    // best-effort
  }

  if (states.group.getState().details?.id === groupId) {
    states.group.setState((prev) => ({
      ...prev,
      settlementList: prev.settlementList.filter((p) => keep(p as Payment))
    }));
  }

  // Clear from the home tab activityList too.
  states.expense.setState((prev) => ({
    ...prev,
    activityList: prev.activityList.filter((p) => !ids.has(p.id))
  }));

  // Friend settlements — clean each involved friend's cache.
  if (!userId) return;
  const friendIds = new Set<string>();
  for (const p of payments) {
    if (p.member.id === userId) friendIds.add(p.payer.id);
    else if (p.payer.id === userId) friendIds.add(p.member.id);
  }
  for (const friendId of friendIds) {
    try {
      const fcached = await cacheService.getFriendSettlements(friendId);
      if (fcached) {
        await cacheService.saveFriendSettlements(
          friendId,
          (fcached.active as Payment[]).filter(keep),
          fcached.settled
        );
      }
    } catch {
      // best-effort
    }
  }
}

/**
 * The still-active (pending/requested) settlements for an expense, read from the
 * group's cached settlement snapshot. Used as the "before" payments when an
 * offline edit or delete needs to back a synced expense's amounts out of the
 * Overview stats. Returns [] when the group's settlements were never cached.
 */
async function getActivePaymentsForExpense(
  groupId: string,
  expenseId: string
): Promise<Payment[]> {
  try {
    const cached = await cacheService.getGroupSettlements(groupId);
    if (!cached) return [];
    return (cached.active as Payment[]).filter(
      (p) => p.expense_id === expenseId
    );
  } catch {
    return [];
  }
}

/**
 * Swap an expense's settlements for a freshly computed set in the group's cached
 * + live settlement lists (offline edit). Old rows are matched by `expense_id`
 * (not payment id — an edit mints new optimistic ids), so a repeated edit reads
 * the current amounts back via `getActivePaymentsForExpense` and the Settlements
 * tab stays consistent with the edited expense detail. Only the current user's
 * rows are kept, mirroring how the settlement views filter.
 */
async function replaceGroupSettlementPaymentsForExpense(
  groupId: string,
  expenseId: string,
  newPayments: Payment[],
  userId: string | undefined
) {
  if (!userId) return;
  const userPayments = newPayments.filter(
    (p) => p.member.id === userId || p.payer.id === userId
  );
  const otherExpense = (p: Payment) => p.expense_id !== expenseId;

  try {
    const cached = await cacheService.getGroupSettlements(groupId);
    if (cached) {
      await cacheService.saveGroupSettlements(
        groupId,
        [
          ...userPayments,
          ...(cached.active as Payment[]).filter(otherExpense)
        ],
        cached.settled
      );
    }
  } catch {
    // best-effort
  }

  states.group.setState((prev) => ({
    ...prev,
    settlementList:
      prev.details?.id === groupId
        ? [
            ...userPayments,
            ...prev.settlementList.filter((p) => otherExpense(p as Payment))
          ]
        : prev.settlementList,
    settlementRefreshToken: prev.settlementRefreshToken + 1
  }));
}

/**
 * Adjust the cached Overview stats (toPay / toReceive) by a set of the current
 * user's optimistic payments so the Net Balance / To Collect / To Pay reflect an
 * offline add / edit / delete before it syncs. `add` payments raise the totals,
 * `remove` payments lower them. Only pending/requested rows the user is part of
 * move the numbers — mirroring `getStatsByUserId`. A draft expense generates no
 * payments, so saving a draft never reaches here and leaves the amounts untouched.
 * Best-effort: the stats self-correct on the next successful online fetch.
 */
async function adjustStatsForPayments(
  userId: string | undefined,
  add: Payment[],
  remove: Payment[]
): Promise<void> {
  if (!userId || (add.length === 0 && remove.length === 0)) return;

  try {
    const cached = (await cacheService.getStats(userId)) as {
      toPay: { currency: string; amount: number }[];
      toReceive: { currency: string; amount: number }[];
    } | null;
    // No baseline (never fetched stats online) — nothing meaningful to adjust.
    if (!cached) return;

    const toPay = new Map(cached.toPay.map((i) => [i.currency, i.amount]));
    const toReceive = new Map(
      cached.toReceive.map((i) => [i.currency, i.amount])
    );

    const apply = (payments: Payment[], sign: 1 | -1) => {
      for (const p of payments) {
        if (
          p.status !== PaymentStatus.PENDING &&
          p.status !== PaymentStatus.REQUESTED
        ) {
          continue;
        }
        const currency = p.currency ?? "PHP";
        if (p.member.id === userId) {
          toPay.set(currency, (toPay.get(currency) ?? 0) + sign * p.amount);
        } else if (p.payer.id === userId) {
          toReceive.set(
            currency,
            (toReceive.get(currency) ?? 0) + sign * p.amount
          );
        }
      }
    };

    apply(add, 1);
    apply(remove, -1);

    // Drop currencies that fall to (about) zero so cleared balances don't linger.
    const toList = (map: Map<string, number>) =>
      Array.from(map.entries())
        .filter(([, amount]) => amount > 0.005)
        .map(([currency, amount]) => ({ currency, amount }));

    await cacheService.saveStats(userId, {
      toPay: toList(toPay),
      toReceive: toList(toReceive)
    });
  } catch {
    // best-effort
  }
}

async function injectPendingGroup(
  userId: string,
  group: Group & { members: Member[] }
) {
  states.group.setState((prev) => ({ ...prev, list: [group, ...prev.list] }));

  try {
    const cached = (await cacheService.getGroupsList(userId)) ?? [];
    await cacheService.saveGroupsList(userId, [group, ...cached]);
  } catch {
    // best-effort
  }
}

async function clearPendingGroup(userId: string, clientId: string) {
  const unmark = (g: Group & { members: Member[] }) =>
    g.id === clientId ? { ...g, pending: false } : g;

  states.group.setState((prev) => ({
    ...prev,
    list: prev.list.map(unmark)
  }));

  try {
    const cached = await cacheService.getGroupsList(userId);
    if (cached) {
      await cacheService.saveGroupsList(
        userId,
        (cached as (Group & { members: Member[] })[]).map(unmark)
      );
    }
  } catch {
    // best-effort
  }
}

/**
 * Replace an expense preview in the group's live list + caches with an edited
 * version, and refresh its detail snapshot so re-opening the editor offline
 * shows the new values.
 */
async function replaceExpenseOptimistic(
  groupId: string,
  expense: ExpensePreview,
  detail?: {
    expense: any;
    payerList: any[];
    memberSplits: any[];
    paymentSplits: any[];
  }
) {
  const swap = (e: ExpensePreview) => (e.id === expense.id ? expense : e);

  if (states.group.getState().details?.id === groupId) {
    states.group.setState((prev) => ({
      ...prev,
      expenseList: prev.expenseList.map(swap)
    }));
  }

  try {
    const cached = await cacheService.getGroupDetail(groupId);
    if (cached) {
      await cacheService.saveGroupDetail(
        groupId,
        cached.expenseList.map(swap),
        cached.memberList
      );
    }
  } catch {
    // best-effort
  }

  if (detail) {
    cacheService
      .saveExpenseDetail(
        expense.id,
        detail.expense,
        detail.payerList,
        detail.memberSplits,
        detail.paymentSplits
      )
      .catch(() => {});
  }
}

/**
 * Remove an expense from the group's live list + caches (offline delete) and
 * decrement the groups-list expense_count.
 */
async function removeExpenseOptimistic(groupId: string, expenseId: string) {
  states.group.setState((prev) => ({
    ...prev,
    expenseList:
      prev.details?.id === groupId
        ? prev.expenseList.filter((e) => e.id !== expenseId)
        : prev.expenseList,
    list: prev.list.map((g) =>
      g.id === groupId
        ? { ...g, expense_count: Math.max((g.expense_count ?? 1) - 1, 0) }
        : g
    )
  }));

  try {
    const cached = await cacheService.getGroupDetail(groupId);
    if (cached) {
      await cacheService.saveGroupDetail(
        groupId,
        cached.expenseList.filter((e: any) => e.id !== expenseId),
        cached.memberList
      );
    }
  } catch {
    // best-effort
  }

  const userId = states.user.getState().details?.id;
  if (userId) {
    try {
      const cachedList = await cacheService.getGroupsList(userId);
      if (cachedList) {
        await cacheService.saveGroupsList(
          userId,
          (cachedList as any[]).map((g: any) =>
            g.id === groupId
              ? {
                  ...g,
                  expense_count: Math.max((g.expense_count ?? 1) - 1, 0)
                }
              : g
          )
        );
      }
    } catch {
      // best-effort
    }
  }
}

/** Patch a group's name/category in the live list + caches (offline edit). */
async function updateGroupOptimistic(
  userId: string,
  groupId: string,
  patch: { name: string; category: string; currency: string }
) {
  const apply = (g: any) =>
    g.id === groupId ? { ...g, ...patch, pending: true } : g;

  states.group.setState((prev) => ({
    ...prev,
    list: prev.list.map(apply),
    details:
      prev.details?.id === groupId ? { ...prev.details, ...patch } : prev.details
  }));

  try {
    const cached = await cacheService.getGroupsList(userId);
    if (cached) {
      await cacheService.saveGroupsList(userId, (cached as any[]).map(apply));
    }
  } catch {
    // best-effort
  }
}

/** Flip a group's archived flag in the caches (offline archive/unarchive). The
 * calling screens already update live Zustand state themselves. */
async function setGroupArchivedInCache(
  userId: string,
  groupId: string,
  archived: boolean
) {
  try {
    const cached = await cacheService.getGroupsList(userId);
    if (cached) {
      await cacheService.saveGroupsList(
        userId,
        (cached as any[]).map((g: any) =>
          g.id === groupId ? { ...g, archived } : g
        )
      );
    }
  } catch {
    // best-effort
  }
}

/**
 * Replace a group's member roster in the live state + the cached group detail.
 * Updating `group_detail.memberList` is what makes an offline-added expense pick
 * up the new roster (the expense flow reads members from that cache offline).
 */
async function updateMembersOptimistic(groupId: string, roster: Member[]) {
  if (states.group.getState().details?.id === groupId) {
    states.group.setState((prev) => ({ ...prev, memberList: roster }));
  }
  try {
    const cached = await cacheService.getGroupDetail(groupId);
    if (cached) {
      await cacheService.saveGroupDetail(groupId, cached.expenseList, roster);
    }
  } catch {
    // best-effort
  }
}

async function addFavoriteToCache(userId: string, favorite: UserPreview) {
  try {
    const cached = (await cacheService.getFavorites(userId)) ?? [];
    if ((cached as UserPreview[]).some((u) => u.id === favorite.id)) return;
    await cacheService.saveFavorites(userId, [favorite, ...cached]);
  } catch {
    // best-effort
  }
}

async function removeFavoriteFromCache(userId: string, favoriteId: string) {
  try {
    const cached = await cacheService.getFavorites(userId);
    if (cached) {
      await cacheService.saveFavorites(
        userId,
        (cached as UserPreview[]).filter((u) => u.id !== favoriteId)
      );
    }
  } catch {
    // best-effort
  }
}

// ---------------------------------------------------------------------------
// Public enqueue helpers used by the create flows
// ---------------------------------------------------------------------------

export async function queueAddExpense(
  groupId: string,
  args: AddExpenseArgs,
  optimistic: ExpensePreview,
  optimisticPayments: Payment[] = [],
  // Member list so the detail snapshot can carry member splits with full user
  // objects — without it, opening the offline expense shows an empty split.
  members: UserPreview[] = [],
  // Local receipt image to re-upload once the expense syncs (uploads are blocked
  // offline, so the file is stashed rather than dropped).
  proofUpload?: ProofUpload
): Promise<void> {
  const payload: AddExpensePayload = {
    clientId: optimistic.id,
    groupId,
    // Pin the server-side id to the optimistic id so the synced expense
    // replaces the optimistic one in place instead of duplicating it.
    args: {
      ...args,
      expensePayload: { ...args.expensePayload, id: optimistic.id }
    },
    optimisticPayments,
    proofUpload
  };
  const currentUserId = states.user.getState().details?.id;
  await enqueue("ADD_EXPENSE", payload);
  await injectPendingExpense(groupId, optimistic);
  await injectPendingPayments(groupId, optimisticPayments, currentUserId);
  // Reflect the new settlements in the Overview's Net Balance / To Collect / To Pay.
  await adjustStatsForPayments(currentUserId, optimisticPayments, []);

  // Warm a per-expense snapshot so the detail screen renders the full split
  // (payers + member splits + settlements) while offline, before any sync.
  if (members.length) {
    const detailMemberSplits = args.memberSplits.map((s) => ({
      // Stable id so the detail screen's keyExtractor (item.id.toString()) works.
      id: `${optimistic.id}-${s.userId}`,
      expense_id: optimistic.id,
      member: members.find((m) => m.id === s.userId),
      amount: s.amount,
      percentage: s.percentage
    }));
    const detailExpense = {
      ...optimistic,
      split_type: args.expensePayload.split_type,
      expense_date:
        args.expensePayload.expense_date ?? optimistic.created_at,
      proof_of_payment: null
    };
    cacheService
      .saveExpenseDetail(
        optimistic.id,
        detailExpense,
        optimistic.payer_list,
        detailMemberSplits,
        optimisticPayments
      )
      .catch(() => {});
  }
}

export async function queueCreateDraft(
  groupId: string,
  args: CreateDraftArgs,
  optimistic: ExpensePreview,
  // Local receipt image to re-upload once the draft syncs (see queueAddExpense).
  proofUpload?: ProofUpload
): Promise<void> {
  const payload: CreateDraftPayload = {
    clientId: optimistic.id,
    groupId,
    // Pin the server-side id to the optimistic id (see queueAddExpense).
    args: {
      ...args,
      expensePayload: { ...args.expensePayload, id: optimistic.id }
    },
    proofUpload
  };
  await enqueue("CREATE_DRAFT", payload);
  // A draft has no payments, so only the expense preview is injected.
  await injectPendingExpense(groupId, optimistic);
}

export async function queueCreateGroup(
  userId: string,
  args: CreateGroupArgs,
  optimistic: Group & { members: Member[] }
): Promise<void> {
  const payload: CreateGroupPayload = {
    clientId: optimistic.id,
    userId,
    // Pin the server-side id to the optimistic id (see queueAddExpense).
    args: { ...args, id: optimistic.id }
  };
  await enqueue("CREATE_GROUP", payload);
  await injectPendingGroup(userId, optimistic);

  // Seed an empty detail snapshot so the pending group is viewable offline.
  cacheService
    .saveGroupDetail(optimistic.id, [], optimistic.members)
    .catch(() => {});
}

/**
 * Queue an expense edit. If the expense is still a pending offline create, the
 * edit is folded into that create op (one write reaches the server) instead of
 * enqueuing a separate update against a row that doesn't exist yet.
 */
export async function queueUpdateExpense(
  groupId: string,
  expenseId: string,
  args: UpdateExpenseArgs,
  optimistic: ExpensePreview,
  detail?: {
    expense: any;
    payerList: any[];
    memberSplits: any[];
    paymentSplits: any[];
  }
): Promise<void> {
  const createOp = await findPendingExpenseCreate(expenseId);

  // Back the pre-edit amounts out of the Overview stats and fold the new ones in
  // (drafts carry no payment splits, so their edits leave the amounts untouched).
  const editUserId = states.user.getState().details?.id;
  const oldPayments = await getActivePaymentsForExpense(groupId, expenseId);
  const newPayments = (detail?.paymentSplits as Payment[] | undefined) ?? [];
  await adjustStatsForPayments(editUserId, newPayments, oldPayments);
  // Keep the group's settlement cache/list in step so a repeat edit reads the
  // current amounts and the Settlements tab matches the edited expense.
  await replaceGroupSettlementPaymentsForExpense(
    groupId,
    expenseId,
    newPayments,
    editUserId
  );

  if (createOp && createOp.type === "ADD_EXPENSE") {
    // Coalesce: rewrite the pending create with the edited values. An unsynced
    // expense can't have an uploaded proof, so it stays null.
    const patched: AddExpensePayload = {
      ...createOp.payload,
      args: {
        expensePayload: {
          ...createOp.payload.args.expensePayload,
          amount: args.expensePayload.amount,
          description: args.expensePayload.description,
          proof_of_payment: null,
          split_type: args.expensePayload.split_type,
          currency: args.expensePayload.currency,
          category: args.expensePayload.category,
          expense_date: args.expensePayload.expense_date
        },
        payers: args.payers,
        memberSplits: args.memberSplits,
        paymentSplits: args.paymentSplits
      },
      // Keep the optimistic settlements in step with the edit so, once this
      // create syncs, the right rows are cleared from the settlement caches
      // (they were just replaced by `replaceGroupSettlementPaymentsForExpense`).
      optimisticPayments: newPayments.length
        ? newPayments
        : createOp.payload.optimisticPayments
    };
    await updateQueuePayload(createOp.id, patched);
  } else {
    await enqueue("UPDATE_EXPENSE", {
      clientId: optimistic.id,
      groupId,
      expenseId,
      args
    } as UpdateExpensePayload);
  }

  await replaceExpenseOptimistic(groupId, optimistic, detail);
}

/**
 * Queue an expense delete. If the expense is still a pending offline create, the
 * create op is dropped entirely (nothing ever syncs) along with its optimistic
 * settlements; otherwise a DELETE_EXPENSE op is enqueued.
 */
export async function queueDeleteExpense(
  groupId: string,
  expenseId: string
): Promise<void> {
  const createOp = await findPendingExpenseCreate(expenseId);
  const userId = states.user.getState().details?.id;

  // The settlements being removed, so their amounts can be backed out of the
  // Overview stats. A pending create carries its optimistic payments inline; a
  // synced expense's active payments come from the cached settlement snapshot.
  let removedPayments: Payment[] = [];

  if (createOp) {
    await removeFromQueue(createOp.id);
    if (createOp.type === "ADD_EXPENSE") {
      removedPayments = createOp.payload.optimisticPayments ?? [];
      await clearPendingPaymentsForExpense(groupId, removedPayments, userId);
    }
  } else {
    removedPayments = await getActivePaymentsForExpense(groupId, expenseId);
    await enqueue("DELETE_EXPENSE", {
      groupId,
      expenseId
    } as DeleteExpensePayload);
    // Drop the deleted expense's settlements from the settlement caches/lists so
    // the Settlements tab doesn't keep showing them offline.
    await clearPendingPaymentsForExpense(groupId, removedPayments, userId);
  }

  await removeExpenseOptimistic(groupId, expenseId);
  await adjustStatsForPayments(userId, [], removedPayments);
}

/**
 * Queue a group edit (name/category). Folds into a still-pending create op so
 * the group is created with the edited values instead of update-after-create.
 */
export async function queueUpdateGroup(
  userId: string,
  groupId: string,
  args: UpdateGroupArgs
): Promise<void> {
  const ops = await getQueue();
  const createOp = ops.find(
    (o) =>
      o.status === "pending" &&
      o.type === "CREATE_GROUP" &&
      o.payload.clientId === groupId
  );

  if (createOp && createOp.type === "CREATE_GROUP") {
    const patched: CreateGroupPayload = {
      ...createOp.payload,
      args: {
        ...createOp.payload.args,
        name: args.name,
        category: args.category,
        currency: args.currency
      }
    };
    await updateQueuePayload(createOp.id, patched);
  } else {
    await enqueue("UPDATE_GROUP", { groupId, args } as UpdateGroupPayload);
  }

  await updateGroupOptimistic(userId, groupId, {
    name: args.name,
    category: args.category,
    currency: args.currency
  });
}

/**
 * Queue a group archive/unarchive (offline "delete" = archive). Coalesces a
 * repeated toggle on the same group into one op.
 */
export async function queueSetGroupArchived(
  userId: string,
  groupId: string,
  archived: boolean
): Promise<void> {
  const ops = await getQueue();
  const existing = ops.find(
    (o) =>
      o.status === "pending" &&
      o.type === "SET_GROUP_ARCHIVED" &&
      o.payload.groupId === groupId
  );

  if (existing) {
    await updateQueuePayload(existing.id, {
      groupId,
      archived
    } as SetGroupArchivedPayload);
  } else {
    await enqueue("SET_GROUP_ARCHIVED", {
      groupId,
      archived
    } as SetGroupArchivedPayload);
  }

  await setGroupArchivedInCache(userId, groupId, archived);
}

/**
 * Queue a group member-roster edit (admin-only). `roster` is the full desired
 * member list, used for the optimistic update. Coalesces into a still-pending
 * group create (folds into its member_ids), or merges with a pending member edit
 * (an add cancels a pending remove of the same id, and vice versa).
 */
export async function queueUpdateMembers(
  groupId: string,
  membersToAdd: string[],
  membersToRemove: string[],
  roster: Member[]
): Promise<void> {
  const ops = await getQueue();

  const createOp = ops.find(
    (o) =>
      o.status === "pending" &&
      o.type === "CREATE_GROUP" &&
      o.payload.clientId === groupId
  );

  if (createOp && createOp.type === "CREATE_GROUP") {
    const ids = new Set(createOp.payload.args.member_ids);
    membersToAdd.forEach((id) => ids.add(id));
    membersToRemove.forEach((id) => ids.delete(id));
    await updateQueuePayload(createOp.id, {
      ...createOp.payload,
      args: { ...createOp.payload.args, member_ids: Array.from(ids) }
    } as CreateGroupPayload);
  } else {
    const existing = ops.find(
      (o) =>
        o.status === "pending" &&
        o.type === "UPDATE_MEMBERS" &&
        (o.payload as UpdateMembersPayload).groupId === groupId
    );

    if (existing && existing.type === "UPDATE_MEMBERS") {
      const p = existing.payload as UpdateMembersPayload;
      const addSet = new Set(p.membersToAdd);
      const removeSet = new Set(p.membersToRemove);
      membersToAdd.forEach((id) => {
        removeSet.delete(id);
        addSet.add(id);
      });
      membersToRemove.forEach((id) => {
        addSet.delete(id);
        removeSet.add(id);
      });
      await updateQueuePayload(existing.id, {
        groupId,
        membersToAdd: Array.from(addSet),
        membersToRemove: Array.from(removeSet)
      } as UpdateMembersPayload);
    } else {
      await enqueue("UPDATE_MEMBERS", {
        groupId,
        membersToAdd,
        membersToRemove
      } as UpdateMembersPayload);
    }
  }

  await updateMembersOptimistic(groupId, roster);
}

/** Queue a favorite add. An add that cancels a pending remove just drops it. */
export async function queueAddFavorite(
  userId: string,
  favorite: UserPreview
): Promise<void> {
  const pendingRemove = await findPendingFavorite(
    "REMOVE_FAVORITE",
    userId,
    favorite.id
  );
  if (pendingRemove) {
    await removeFromQueue(pendingRemove.id);
  } else {
    const pendingAdd = await findPendingFavorite(
      "ADD_FAVORITE",
      userId,
      favorite.id
    );
    if (!pendingAdd) {
      await enqueue("ADD_FAVORITE", {
        userId,
        favoriteId: favorite.id
      } as FavoritePayload);
    }
  }
  await addFavoriteToCache(userId, favorite);
}

/**
 * Queue a user-preferences patch (e.g. app appearance). Coalesces into a single
 * pending op per user by merging the patch, so the latest values win.
 */
export async function queueUpdatePreferences(
  userId: string,
  prefs: Record<string, any>
): Promise<void> {
  const ops = await getQueue();
  const existing = ops.find(
    (o) =>
      o.status === "pending" &&
      o.type === "UPDATE_PREFERENCES" &&
      (o.payload as UpdatePreferencesPayload).userId === userId
  );

  if (existing) {
    const merged = {
      userId,
      prefs: {
        ...(existing.payload as UpdatePreferencesPayload).prefs,
        ...prefs
      }
    } as UpdatePreferencesPayload;
    await updateQueuePayload(existing.id, merged);
  } else {
    await enqueue("UPDATE_PREFERENCES", {
      userId,
      prefs
    } as UpdatePreferencesPayload);
  }
}

/**
 * The merged preferences from any pending UPDATE_PREFERENCES ops for a user.
 * Read on launch so an offline preference change (e.g. appearance) is reflected
 * even after a restart, before it has synced. Returns null if nothing pending.
 */
export async function getPendingPreferences(
  userId: string
): Promise<Record<string, any> | null> {
  const ops = await getQueue();
  const merged = ops
    .filter(
      (o) =>
        o.status === "pending" &&
        o.type === "UPDATE_PREFERENCES" &&
        (o.payload as UpdatePreferencesPayload).userId === userId
    )
    .reduce<Record<string, any>>(
      (acc, o) => ({
        ...acc,
        ...(o.payload as UpdatePreferencesPayload).prefs
      }),
      {}
    );
  return Object.keys(merged).length ? merged : null;
}

/** Queue a favorite remove. A remove that cancels a pending add just drops it. */
export async function queueRemoveFavorite(
  userId: string,
  favoriteId: string
): Promise<void> {
  const pendingAdd = await findPendingFavorite(
    "ADD_FAVORITE",
    userId,
    favoriteId
  );
  if (pendingAdd) {
    await removeFromQueue(pendingAdd.id);
  } else {
    const pendingRemove = await findPendingFavorite(
      "REMOVE_FAVORITE",
      userId,
      favoriteId
    );
    if (!pendingRemove) {
      await enqueue("REMOVE_FAVORITE", {
        userId,
        favoriteId
      } as FavoritePayload);
    }
  }
  await removeFavoriteFromCache(userId, favoriteId);
}

// ---------------------------------------------------------------------------
// Optimistic object builders — shape a not-yet-synced item like the server
// response so the list UIs render it without special-casing.
// ---------------------------------------------------------------------------

export function buildOptimisticExpense(params: {
  clientId: string;
  groupId: string;
  amount: number;
  description: string;
  currency: string;
  category?: string;
  creator: UserPreview;
  payers: { userId: string; amount: number }[];
  members: UserPreview[];
}): ExpensePreview {
  const now = new Date().toISOString();

  const payer_list: ExpensePayer[] = params.payers.map((p) => ({
    id: uuid(),
    created_at: now,
    expense_id: params.clientId,
    payer: params.members.find((m) => m.id === p.userId) ?? params.creator,
    amount: p.amount,
    currency: params.currency
  }));

  return {
    id: params.clientId,
    created_at: now,
    group_id: params.groupId,
    amount: params.amount,
    description: params.description,
    creator: params.creator,
    currency: params.currency,
    category: params.category || "other",
    status: PaymentStatus.PENDING,
    is_draft: false,
    payer_list,
    pending: true
  };
}

/**
 * Build an optimistic draft `ExpensePreview` (no payers, flagged as a draft) so
 * an offline-saved draft renders in the creator's list immediately.
 */
export function buildOptimisticDraft(params: {
  clientId: string;
  groupId: string;
  amount: number;
  description: string;
  currency: string;
  category?: string;
  creator: UserPreview;
}): ExpensePreview {
  return {
    id: params.clientId,
    created_at: new Date().toISOString(),
    group_id: params.groupId,
    amount: params.amount,
    description: params.description,
    creator: params.creator,
    currency: params.currency,
    category: params.category || "other",
    status: PaymentStatus.ONGOING,
    is_draft: true,
    payer_list: [],
    pending: true
  };
}

/**
 * Build optimistic `Payment` rows from an expense's computed payment splits so
 * the new settlements render (flagged pending) in the group + friend views.
 * `paymentSplits` come from `generatePaymentSplits` where `memberSplitId` is the
 * debtor's userId and `payerId` is the creditor's userId.
 */
export function buildOptimisticPayments(params: {
  expenseId: string;
  groupId: string;
  description: string;
  currency: string;
  members: UserPreview[];
  currentUser: UserPreview;
  paymentSplits: { memberSplitId: string; payerId: string; amount: number }[];
}): Payment[] {
  const now = new Date().toISOString();
  const resolve = (id: string): UserPreview | null =>
    params.members.find((m) => m.id === id) ??
    (params.currentUser.id === id ? params.currentUser : null);

  return params.paymentSplits
    .map((s) => {
      const member = resolve(s.memberSplitId);
      const payer = resolve(s.payerId);
      if (!member || !payer) return null;
      return {
        id: uuid(),
        created_at: now,
        group_id: params.groupId,
        expense_id: params.expenseId,
        expense_description: params.description,
        member,
        payer,
        amount: s.amount,
        currency: params.currency,
        proof_of_payment: null,
        member_note: null,
        payer_note: null,
        status: PaymentStatus.PENDING,
        status_updated_at: now,
        pending: true
      } as Payment;
    })
    .filter((p): p is Payment => p !== null);
}

export function buildOptimisticGroup(params: {
  clientId: string;
  name: string;
  category: string;
  currency: string;
  admin: UserPreview;
  members: UserPreview[];
}): Group & { members: Member[] } {
  const now = new Date().toISOString();

  return {
    id: params.clientId,
    created_at: now,
    admin: params.admin,
    name: params.name,
    category: params.category,
    currency: params.currency,
    avatar: null,
    archived: false,
    expense_count: 0,
    pending: true,
    members: params.members.map((m) => ({
      ...m,
      group_id: params.clientId,
      joined_at: now
    }))
  };
}

// ---------------------------------------------------------------------------
// Personal "Books" — optimistic injection + queue helpers. Simpler than the
// group flow (no payers/splits/settlements): offline ops are enqueued in order
// (FIFO), so a create-then-edit-then-delete done offline replays create → edit
// → delete on the same pinned id, with no coalescing needed.
// ---------------------------------------------------------------------------

/** Add `delta` to a currency's total, dropping near-zero entries; sorted desc. */
function applyCurrencyDelta(
  totals: PersonalBookTotal[],
  currency: string,
  delta: number,
  status: "paid" | "pending"
): PersonalBookTotal[] {
  const map = new Map(
    totals.map((t) => [t.currency, { paid: t.paid, pending: t.pending }])
  );
  const entry = map.get(currency) ?? { paid: 0, pending: 0 };
  entry[status] += delta;
  map.set(currency, entry);
  return Array.from(map.entries())
    .map(([c, v]) => ({ currency: c, paid: v.paid, pending: v.pending }))
    .filter((t) => Math.abs(t.paid) > 0.005 || Math.abs(t.pending) > 0.005)
    .sort((a, b) => b.paid + b.pending - (a.paid + a.pending));
}

/** Nudge a book's expense_count in the live list + cached books list. */
async function bumpBookExpenseCount(
  userId: string | undefined,
  bookId: string,
  delta: number
) {
  const apply = (b: Book) =>
    b.id === bookId
      ? { ...b, expense_count: Math.max((b.expense_count ?? 0) + delta, 0) }
      : b;

  states.book.setState((prev) => ({ ...prev, list: prev.list.map(apply) }));

  if (!userId) return;
  try {
    const cached = await cacheService.getBooksList(userId);
    if (cached) {
      await cacheService.saveBooksList(userId, (cached as Book[]).map(apply));
    }
  } catch {
    // best-effort
  }
}

async function injectPendingBook(userId: string, book: Book) {
  states.book.setState((prev) => ({ ...prev, list: [book, ...prev.list] }));
  try {
    const cached = (await cacheService.getBooksList(userId)) ?? [];
    await cacheService.saveBooksList(userId, [book, ...cached]);
  } catch {
    // best-effort
  }
}

async function clearPendingBook(userId: string, clientId: string) {
  const unmark = (b: Book) =>
    b.id === clientId ? { ...b, pending: false } : b;
  states.book.setState((prev) => ({ ...prev, list: prev.list.map(unmark) }));
  try {
    const cached = await cacheService.getBooksList(userId);
    if (cached) {
      await cacheService.saveBooksList(userId, (cached as Book[]).map(unmark));
    }
  } catch {
    // best-effort
  }
}

async function updateBookOptimistic(
  userId: string,
  bookId: string,
  patch: { name: string; category: string; currency: string }
) {
  const apply = (b: Book) =>
    b.id === bookId ? { ...b, ...patch, pending: true } : b;

  states.book.setState((prev) => ({
    ...prev,
    list: prev.list.map(apply),
    details:
      prev.details?.id === bookId ? { ...prev.details, ...patch } : prev.details
  }));

  try {
    const cached = await cacheService.getBooksList(userId);
    if (cached) {
      await cacheService.saveBooksList(userId, (cached as Book[]).map(apply));
    }
  } catch {
    // best-effort
  }
  try {
    const d = await cacheService.getBookDetail(bookId);
    if (d) {
      await cacheService.saveBookDetail(
        bookId,
        { ...d.book, ...patch },
        d.expenseList,
        d.totals
      );
    }
  } catch {
    // best-effort
  }
}

/** Drop an archived book from the active books cache (it leaves the list). */
async function setBookArchivedInCache(userId: string, bookId: string) {
  try {
    const cached = await cacheService.getBooksList(userId);
    if (cached) {
      await cacheService.saveBooksList(
        userId,
        (cached as Book[]).filter((b) => b.id !== bookId)
      );
    }
  } catch {
    // best-effort
  }
}

async function injectPendingBookExpense(
  bookId: string,
  expense: PersonalExpense
) {
  const userId = states.user.getState().details?.id;

  states.book.setState((prev) => ({
    ...prev,
    expenseList:
      prev.details?.id === bookId
        ? [expense, ...prev.expenseList]
        : prev.expenseList
  }));

  try {
    const cached = await cacheService.getBookDetail(bookId);
    if (cached) {
      await cacheService.saveBookDetail(
        bookId,
        cached.book,
        [expense, ...cached.expenseList],
        applyCurrencyDelta(
          cached.totals,
          expense.currency,
          expense.amount,
          expense.status
        )
      );
    }
  } catch {
    // best-effort
  }
  await bumpBookExpenseCount(userId, bookId, 1);
}

async function clearPendingBookExpense(bookId: string, clientId: string) {
  const unmark = (e: PersonalExpense) =>
    e.id === clientId ? { ...e, pending: false } : e;

  if (states.book.getState().details?.id === bookId) {
    states.book.setState((prev) => ({
      ...prev,
      expenseList: prev.expenseList.map(unmark)
    }));
  }
  try {
    const cached = await cacheService.getBookDetail(bookId);
    if (cached) {
      await cacheService.saveBookDetail(
        bookId,
        cached.book,
        cached.expenseList.map(unmark),
        cached.totals
      );
    }
  } catch {
    // best-effort
  }
}

async function replaceBookExpenseOptimistic(
  bookId: string,
  expense: PersonalExpense,
  oldAmount: number,
  oldCurrency: string,
  oldStatus: "paid" | "pending"
) {
  const swap = (e: PersonalExpense) => (e.id === expense.id ? expense : e);

  if (states.book.getState().details?.id === bookId) {
    states.book.setState((prev) => ({
      ...prev,
      expenseList: prev.expenseList.map(swap)
    }));
  }
  try {
    const cached = await cacheService.getBookDetail(bookId);
    if (cached) {
      // Back the old value out of its old status bucket, fold the new one in.
      let totals = applyCurrencyDelta(
        cached.totals,
        oldCurrency,
        -oldAmount,
        oldStatus
      );
      totals = applyCurrencyDelta(
        totals,
        expense.currency,
        expense.amount,
        expense.status
      );
      await cacheService.saveBookDetail(
        bookId,
        cached.book,
        cached.expenseList.map(swap),
        totals
      );
    }
  } catch {
    // best-effort
  }
}

async function setBookExpenseStatusOptimistic(
  bookId: string,
  expenseId: string,
  status: "paid" | "pending"
) {
  const flip = (e: PersonalExpense) =>
    e.id === expenseId ? { ...e, status } : e;

  if (states.book.getState().details?.id === bookId) {
    states.book.setState((prev) => ({
      ...prev,
      expenseList: prev.expenseList.map(flip)
    }));
  }
  try {
    const cached = await cacheService.getBookDetail(bookId);
    if (cached) {
      const target = cached.expenseList.find(
        (e: PersonalExpense) => e.id === expenseId
      );
      let totals = cached.totals as PersonalBookTotal[];
      // Move the expense's amount from its old status bucket to the new one
      // (same currency) — the combined total is unchanged, only the split.
      if (target && target.status !== status) {
        totals = applyCurrencyDelta(
          totals,
          target.currency,
          -target.amount,
          target.status
        );
        totals = applyCurrencyDelta(
          totals,
          target.currency,
          target.amount,
          status
        );
      }
      await cacheService.saveBookDetail(
        bookId,
        cached.book,
        cached.expenseList.map(flip),
        totals
      );
    }
  } catch {
    // best-effort
  }
}

async function removeBookExpenseOptimistic(
  bookId: string,
  expenseId: string,
  amount: number,
  currency: string,
  status: "paid" | "pending"
) {
  const userId = states.user.getState().details?.id;

  if (states.book.getState().details?.id === bookId) {
    states.book.setState((prev) => ({
      ...prev,
      expenseList: prev.expenseList.filter((e) => e.id !== expenseId)
    }));
  }
  try {
    const cached = await cacheService.getBookDetail(bookId);
    if (cached) {
      await cacheService.saveBookDetail(
        bookId,
        cached.book,
        cached.expenseList.filter((e) => e.id !== expenseId),
        applyCurrencyDelta(cached.totals, currency, -amount, status)
      );
    }
  } catch {
    // best-effort
  }
  await bumpBookExpenseCount(userId, bookId, -1);
}

export function buildOptimisticBook(params: {
  clientId: string;
  name: string;
  category: string;
  currency: string;
  userId: string;
}): Book {
  return {
    id: params.clientId,
    created_at: new Date().toISOString(),
    user_id: params.userId,
    name: params.name,
    category: params.category,
    avatar: null,
    currency: params.currency,
    budget: null,
    archived: false,
    group_id: null,
    expense_count: 0,
    pending: true
  };
}

export function buildOptimisticPersonalExpense(params: {
  clientId: string;
  bookId: string;
  userId: string;
  amount: number;
  description: string;
  category: string;
  currency: string;
  expenseDate?: string;
  status?: "paid" | "pending";
}): PersonalExpense {
  const now = new Date().toISOString();
  return {
    id: params.clientId,
    created_at: now,
    book_id: params.bookId,
    user_id: params.userId,
    amount: params.amount,
    description: params.description,
    category: params.category,
    currency: params.currency,
    expense_date: params.expenseDate ?? now,
    proof_of_payment: null,
    recurring_id: null,
    status: params.status ?? "paid",
    pending: true
  };
}

export async function queueCreateBook(
  userId: string,
  args: CreateBookArgs,
  optimistic: Book
): Promise<void> {
  const payload: CreateBookPayload = {
    clientId: optimistic.id,
    userId,
    // Pin the server id to the optimistic id so the synced book replaces the
    // optimistic one in place instead of duplicating it.
    args: { ...args, id: optimistic.id }
  };
  await enqueue("CREATE_BOOK", payload);
  await injectPendingBook(userId, optimistic);
}

export async function queueUpdateBook(
  userId: string,
  bookId: string,
  args: UpdateBookArgs
): Promise<void> {
  await enqueue("UPDATE_BOOK", { bookId, args } as UpdateBookPayload);
  await updateBookOptimistic(userId, bookId, {
    name: args.name,
    category: args.category,
    currency: args.currency
  });
}

export async function queueSetBookArchived(
  userId: string,
  bookId: string,
  archived: boolean
): Promise<void> {
  await enqueue("SET_BOOK_ARCHIVED", {
    bookId,
    archived
  } as SetBookArchivedPayload);
  // Archiving removes the book from the active list; the screen already updates
  // live state, so here we only keep the cached active snapshot in step.
  if (archived) await setBookArchivedInCache(userId, bookId);
}

export async function queueAddPersonalExpense(
  bookId: string,
  args: AddPersonalExpenseArgs,
  optimistic: PersonalExpense,
  proofUpload?: ProofUpload
): Promise<void> {
  const payload: AddPersonalExpensePayload = {
    clientId: optimistic.id,
    bookId,
    args: { ...args, id: optimistic.id },
    proofUpload
  };
  await enqueue("ADD_PERSONAL_EXPENSE", payload);
  await injectPendingBookExpense(bookId, optimistic);
}

export async function queueUpdatePersonalExpense(
  bookId: string,
  expenseId: string,
  args: UpdatePersonalExpenseArgs,
  optimistic: PersonalExpense,
  oldAmount: number,
  oldCurrency: string,
  oldStatus: "paid" | "pending",
  proofUpload?: ProofUpload
): Promise<void> {
  await enqueue("UPDATE_PERSONAL_EXPENSE", {
    bookId,
    expenseId,
    args,
    proofUpload
  } as UpdatePersonalExpensePayload);
  await replaceBookExpenseOptimistic(
    bookId,
    optimistic,
    oldAmount,
    oldCurrency,
    oldStatus
  );
}

export async function queueDeletePersonalExpense(
  bookId: string,
  expenseId: string,
  amount: number,
  currency: string,
  status: "paid" | "pending"
): Promise<void> {
  await enqueue("DELETE_PERSONAL_EXPENSE", {
    bookId,
    expenseId
  } as DeletePersonalExpensePayload);
  await removeBookExpenseOptimistic(bookId, expenseId, amount, currency, status);
}

export async function queueSetPersonalExpenseStatus(
  bookId: string,
  expenseId: string,
  status: "paid" | "pending"
): Promise<void> {
  await enqueue("TOGGLE_PERSONAL_EXPENSE_STATUS", {
    bookId,
    expenseId,
    status
  } as TogglePersonalExpenseStatusPayload);
  await setBookExpenseStatusOptimistic(bookId, expenseId, status);
}

export const _internal = {
  clearPendingExpense,
  clearPendingGroup,
  clearPendingPaymentsForExpense,
  clearPendingBook,
  clearPendingBookExpense
};
