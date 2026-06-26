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
      } catch {
        // Skip this group and keep warming the rest.
      }
    }
  } finally {
    prefetching = false;
  }
}
