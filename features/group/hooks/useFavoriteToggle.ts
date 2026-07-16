import useAppToast from "@/hooks/use-app-toast";
import services from "@/services";
import { UserPreview } from "@/types/user";
import { useState } from "react";

export function useFavoriteToggle(userId: string | undefined) {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoriteUsers, setFavoriteUsers] = useState<UserPreview[]>([]);

  const toast = useAppToast();

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
    const name =
      `${targetUser.first_name} ${targetUser.last_name}`.trim() || "This person";
    try {
      if (favoriteIds.has(targetUser.id)) {
        await services.friend.removeFavorite(userId, targetUser.id);
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          next.delete(targetUser.id);
          return next;
        });
        setFavoriteUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
        toast({
          title: "Removed from favorites",
          description: `${name} was removed from your favorites.`,
          type: "muted"
        });
      } else {
        await services.friend.addFavorite(userId, targetUser.id, targetUser);
        setFavoriteIds((prev) => new Set([...prev, targetUser.id]));
        setFavoriteUsers((prev) => [targetUser, ...prev]);
        toast({
          title: "Added to favorites",
          description: `${name} is now in your favorites.`,
          type: "success"
        });
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
      toast({
        title: "Something went wrong",
        description: "Couldn't update favorites. Please try again.",
        type: "error"
      });
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
