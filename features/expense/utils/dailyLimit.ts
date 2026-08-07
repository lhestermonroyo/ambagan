import services from "@/services";
import { cacheService } from "@/utils/cacheService";
import * as offlineQueue from "@/utils/offlineQueue";

// Local-day key (not a UTC ISO date) so the cached daily count is compared
// against the same calendar day the user is in.
const dayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/**
 * The user's group-expense count for today, usable offline. Online: the live
 * server count, cached for later offline reads. Offline: the last cached server
 * count for today (0 if missing or from another day) plus the ADD_EXPENSE ops
 * queued today — so the free-tier daily limit stays enforced without a server
 * round trip. The two never overlap: queued ops aren't in the cached server
 * count until they sync, at which point the queue is empty again.
 */
export async function resolveDailyCount(userId: string): Promise<number> {
  if (await offlineQueue.isOnline()) {
    const count = await services.expense.getDailyExpenseCount(userId);
    await cacheService.saveDailyExpenseCount(userId, count, dayKey());
    return count;
  }
  const cached = await cacheService.getDailyExpenseCount(userId);
  const base = cached && cached.dayKey === dayKey() ? cached.count : 0;
  const queuedToday = await offlineQueue.countExpensesQueuedToday();
  return base + queuedToday;
}

/**
 * The personal-expense count for today — the same scheme against the separate
 * personal bucket (a free user gets 5 group + 5 personal expenses a day).
 */
export async function resolvePersonalDailyCount(
  userId: string
): Promise<number> {
  if (await offlineQueue.isOnline()) {
    const count = await services.bookExpense.getDailyPersonalCount(userId);
    await cacheService.saveDailyPersonalCount(userId, count, dayKey());
    return count;
  }
  const cached = await cacheService.getDailyPersonalCount(userId);
  const base = cached && cached.dayKey === dayKey() ? cached.count : 0;
  const queuedToday = await offlineQueue.countPersonalExpensesQueuedToday();
  return base + queuedToday;
}
