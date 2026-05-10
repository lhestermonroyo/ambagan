import services from "@/services";
import { UserPreview } from "@/types/user";
import { useState } from "react";

export function useFavoriteToggle(userId: string | undefined) {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoriteUsers, setFavoriteUsers] = useState<UserPreview[]>([]);

  const loadFavorites = async (filterFn?: (u: UserPreview) => boolean) => {
    if (!userId) return;
    try {
      const data = await services.friend.getFavorites(userId);
      const filtered = filterFn ? data.filter(filterFn) : data;
      setFavoriteUsers(filtered);
      setFavoriteIds(new Set(filtered.map((u) => u.id)));
    } catch (error) {
      console.error("Error fetching favorites:", error);
    }
  };

  const handleToggleFavorite = async (targetUser: UserPreview) => {
    if (!userId) return;
    try {
      if (favoriteIds.has(targetUser.id)) {
        await services.friend.removeFavorite(userId, targetUser.id);
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          next.delete(targetUser.id);
          return next;
        });
        setFavoriteUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
      } else {
        await services.friend.addFavorite(userId, targetUser.id);
        setFavoriteIds((prev) => new Set([...prev, targetUser.id]));
        setFavoriteUsers((prev) => [targetUser, ...prev]);
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
    }
  };

  const resetFavorites = () => {
    setFavoriteIds(new Set());
    setFavoriteUsers([]);
  };

  return {
    favoriteIds,
    favoriteUsers,
    loadFavorites,
    handleToggleFavorite,
    resetFavorites
  };
}
