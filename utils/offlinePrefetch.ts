import services from "@/services";
import { cacheService } from "./cacheService";
import { isOnline } from "./offlineQueue";

let prefetching = false;

/**
 * Warms the offline cache for each group's detail (expenses + members) and
 * active settlements, so every group is viewable offline without the user
 * opening each one first.
 *
 * Designed to never obstruct the UX: it's fire-and-forget, runs sequentially
 * (one group at a time so it never floods the network), is best-effort
 * (per-group failures are swallowed), only runs while online, and never
 * touches live UI state — it writes to the cache only.
 */
export async function prefetchGroupDetails(
  userId: string,
  groups: { id: string }[]
): Promise<void> {
  if (prefetching || groups.length === 0) return;
  if (!(await isOnline())) return;

  prefetching = true;
  try {
    for (const group of groups) {
      try {
        const [expenses, members, active] = await Promise.all([
          services.expense.getExpensesByGroupId(group.id),
          services.member.getMembersByGroupId(group.id),
          services.expense.getActivePaymentsByGroupAndUserId(group.id, userId)
        ]);

        await cacheService.saveGroupDetail(group.id, expenses, members);

        // Preserve any previously cached settled history; only refresh active.
        const existing = await cacheService
          .getGroupSettlements(group.id)
          .catch(() => null);
        await cacheService.saveGroupSettlements(
          group.id,
          active,
          existing?.settled ?? []
        );

        // Cache per-expense detail (member splits + payment splits) so the
        // expense detail screen is fully viewable offline.
        if (expenses.length > 0) {
          const expenseIds = expenses.map((e) => e.id);
          const [memberSplits, paymentSplits] = await Promise.all([
            services.expense.getMemberSplitsByExpenseIds(expenseIds),
            services.expense.getPaymentsByExpenseIds(expenseIds)
          ]);
          const splitsByExpense: Record<string, typeof memberSplits> = {};
          const paymentsByExpense: Record<string, typeof paymentSplits> = {};
          for (const s of memberSplits) {
            (splitsByExpense[s.expense_id] ??= []).push(s);
          }
          for (const p of paymentSplits) {
            (paymentsByExpense[p.expense_id] ??= []).push(p);
          }
          for (const expense of expenses) {
            await cacheService.saveExpenseDetail(
              expense.id,
              expense,
              (expense as any).payer_list ?? [],
              splitsByExpense[expense.id] ?? [],
              paymentsByExpense[expense.id] ?? []
            );
          }
        }
      } catch {
        // Skip this group and keep warming the rest.
      }
    }
  } finally {
    prefetching = false;
  }
}
