import { UserPreview } from "@/types/user";
import { cacheService } from "./cacheService";
import { getRecentUsers } from "./recentUsers";

/**
 * The pool of people that can be added to a group while offline: recently
 * used contacts (AsyncStorage) plus the cached friends and favorites
 * snapshots. Anyone outside this pool needs a DB lookup and is unavailable
 * until connectivity returns.
 */
export async function getSavedContacts(
  userId: string
): Promise<UserPreview[]> {
  const [recent, friendsCache, favoritesCache] = await Promise.all([
    getRecentUsers(userId).catch(() => [] as UserPreview[]),
    cacheService.getFriends(userId).catch(() => null),
    cacheService.getFavorites(userId).catch(() => null)
  ]);

  const friends = (friendsCache ?? [])
    .map((f: any) => f?.friend as UserPreview)
    .filter(Boolean);
  const favorites = (favoritesCache ?? []) as UserPreview[];

  const byId = new Map<string, UserPreview>();
  [...recent, ...favorites, ...friends].forEach((u) => {
    if (u && u.id !== userId && !byId.has(u.id)) byId.set(u.id, u);
  });

  return Array.from(byId.values());
}

/** Case-insensitive name/email filter over a contacts list. */
export function filterContacts(
  contacts: UserPreview[],
  query: string
): UserPreview[] {
  const q = query.trim().toLowerCase();
  if (!q) return contacts;
  return contacts.filter(
    (u) =>
      `${u.first_name ?? ""} ${u.last_name ?? ""}`.toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q)
  );
}
