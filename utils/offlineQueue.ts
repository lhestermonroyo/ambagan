import states from "@/states";
import {
  ExpensePayer,
  ExpensePreview,
  Payment,
  PaymentPreview,
  PaymentStatus
} from "@/types/expenses";
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
    expense_date?: string;
    id?: string;
  };
};

/**
 * Arguments forwarded verbatim to `services.group.saveGroup` on sync.
 */
export type CreateGroupArgs = {
  name: string;
  category: string;
  avatar: null;
  admin_id: string;
  member_ids: string[];
  id?: string;
};

export type QueueOpType = "ADD_EXPENSE" | "CREATE_DRAFT" | "CREATE_GROUP";

export type AddExpensePayload = {
  clientId: string;
  groupId: string;
  args: AddExpenseArgs;
  /** Optimistic settlements injected offline; cleared on sync. */
  optimisticPayments?: Payment[];
};

export type CreateDraftPayload = {
  clientId: string;
  groupId: string;
  args: CreateDraftArgs;
};

export type CreateGroupPayload = {
  clientId: string;
  userId: string;
  args: CreateGroupArgs;
};

export type QueuedOp =
  | {
      id: string;
      type: "ADD_EXPENSE";
      payload: AddExpensePayload;
      status: "pending" | "failed";
      created_at: number;
    }
  | {
      id: string;
      type: "CREATE_DRAFT";
      payload: CreateDraftPayload;
      status: "pending" | "failed";
      created_at: number;
    }
  | {
      id: string;
      type: "CREATE_GROUP";
      payload: CreateGroupPayload;
      status: "pending" | "failed";
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
    created_at: number;
  }>("SELECT * FROM pending_queue ORDER BY created_at ASC");

  return rows.map(
    (r) =>
      ({
        id: r.id,
        type: r.type as QueueOpType,
        payload: JSON.parse(r.payload),
        status: r.status as "pending" | "failed",
        created_at: r.created_at
      }) as QueuedOp
  );
}

export async function removeFromQueue(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM pending_queue WHERE id = ?", [id]);
}

export async function markFailed(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE pending_queue SET status = 'failed' WHERE id = ?", [
    id
  ]);
}

export async function getPendingCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) as c FROM pending_queue WHERE status = 'pending'"
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

// ---------------------------------------------------------------------------
// Public enqueue helpers used by the create flows
// ---------------------------------------------------------------------------

export async function queueAddExpense(
  groupId: string,
  args: AddExpenseArgs,
  optimistic: ExpensePreview,
  optimisticPayments: Payment[] = []
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
    optimisticPayments
  };
  await enqueue("ADD_EXPENSE", payload);
  await injectPendingExpense(groupId, optimistic);
  await injectPendingPayments(
    groupId,
    optimisticPayments,
    states.user.getState().details?.id
  );
}

export async function queueCreateDraft(
  groupId: string,
  args: CreateDraftArgs,
  optimistic: ExpensePreview
): Promise<void> {
  const payload: CreateDraftPayload = {
    clientId: optimistic.id,
    groupId,
    // Pin the server-side id to the optimistic id (see queueAddExpense).
    args: {
      ...args,
      expensePayload: { ...args.expensePayload, id: optimistic.id }
    }
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

export const _internal = {
  clearPendingExpense,
  clearPendingGroup,
  clearPendingPaymentsForExpense
};
