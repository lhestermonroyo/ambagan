import states from "@/states";
import { ExpensePayer, ExpensePreview, PaymentStatus } from "@/types/expenses";
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

export type QueueOpType = "ADD_EXPENSE" | "CREATE_GROUP";

export type AddExpensePayload = {
  clientId: string;
  groupId: string;
  args: AddExpenseArgs;
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
  // Live state — only if the matching group detail is currently loaded.
  if (states.group.getState().details?.id === groupId) {
    states.group.setState((prev) => ({
      ...prev,
      expenseList: [expense, ...prev.expenseList]
    }));
  }

  // Cache snapshot — so re-opening the group while offline still shows it.
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
    // best-effort — never block the optimistic UI on a cache write
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
  optimistic: ExpensePreview
): Promise<void> {
  const payload: AddExpensePayload = {
    clientId: optimistic.id,
    groupId,
    // Pin the server-side id to the optimistic id so the synced expense
    // replaces the optimistic one in place instead of duplicating it.
    args: {
      ...args,
      expensePayload: { ...args.expensePayload, id: optimistic.id }
    }
  };
  await enqueue("ADD_EXPENSE", payload);
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
    payer_list,
    pending: true
  };
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
  clearPendingGroup
};
