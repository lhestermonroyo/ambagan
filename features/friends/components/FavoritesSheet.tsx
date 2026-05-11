import AppAvatar from "@/components/AppAvatar";
import FormButton from "@/components/FormButton";
import ListDivider from "@/components/ListDivider";
import SearchInput from "@/components/SearchInput";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import RecentFavoritesTab from "@/features/group/components/RecentFavoritesTab";
import { useFavoriteToggle } from "@/features/group/hooks/useFavoriteToggle";
import services from "@/services";
import states from "@/states";
import { UserPreview } from "@/types/user";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import { addRecentUser, getRecentUsers } from "@/utils/recentUsers";
import { Heart } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Keyboard, useColorScheme } from "react-native";

export default function FavoritesSheet({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { details: userDetails } = states.user();
  const colorScheme = useColorScheme() ?? "light";

  const [searchInput, setSearchInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [tab, setTab] = useState<"recent" | "favorites">("recent");
  const [searchResults, setSearchResults] = useState<UserPreview[]>([]);
  const [recentUsers, setRecentUsers] = useState<UserPreview[]>([]);

  const { favoriteIds, favoriteUsers, loadFavorites, handleToggleFavorite } =
    useFavoriteToggle(userDetails?.id);

  useEffect(() => {
    if (!isOpen || !userDetails?.id) return;
    loadFavorites();
    loadRecentUsers();
  }, [isOpen]);

  useEffect(() => {
    fetchUsers();
  }, [searchInput]);

  const loadRecentUsers = async () => {
    try {
      const recent = await getRecentUsers(userDetails!.id);
      setRecentUsers(recent.filter((u) => u.id !== userDetails?.id));
    } catch (error) {
      console.error("Error loading recent users:", error);
    }
  };

  const fetchUsers = async () => {
    if (!searching || !searchInput) {
      setSearchResults([]);
      return;
    }
    try {
      const data = await services.user.searchUsers(searchInput);
      setSearchResults(data.filter((u) => u.id !== userDetails?.id));
    } catch (error) {
      console.error("Error searching users:", error);
    }
  };

  const displayUsers = useMemo(() => {
    if (searching) return searchResults;
    return tab === "favorites" ? favoriteUsers : recentUsers;
  }, [searching, searchResults, tab, favoriteUsers, recentUsers]);

  const handleToggle = async (user: UserPreview) => {
    await handleToggleFavorite(user);
    if (!favoriteIds.has(user.id)) {
      await addRecentUser(user, userDetails!.id);
      loadRecentUsers();
    }
  };

  const handleClose = () => {
    setSearchInput("");
    setSearching(false);
    setTab("recent");
    onClose();
  };

  const emptyLabel = searching
    ? "No results found."
    : tab === "favorites"
      ? "No favorites yet."
      : "No recent users.";

  return (
    <Actionsheet isOpen={isOpen} onClose={handleClose} snapPoints={[90]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full">
          <VStack className="p-4">
            <Text bold className="text-xl">
              Manage Favorites
            </Text>
            <Text className="text-secondary-950">
              Search users and add them to your favorites.
            </Text>
          </VStack>

          <VStack className="gap-y-4">
            <HStack className="px-4 gap-x-2 items-center">
              <VStack className="flex-1">
                <SearchInput
                  placeholder="Search users"
                  value={searchInput}
                  onChangeText={setSearchInput}
                  onSetSearching={setSearching}
                />
              </VStack>
              {searchInput.length > 0 && (
                <FormButton
                  size="sm"
                  variant="outline"
                  text="Cancel"
                  onPress={() => {
                    setSearchInput("");
                    setSearching(false);
                    Keyboard.dismiss();
                  }}
                />
              )}
            </HStack>

            {!searching && (
              <RecentFavoritesTab tab={tab} onTabChange={setTab} />
            )}

            <ScrollView className="w-full" bounces={false}>
              {displayUsers.length === 0 && (
                <VStack className="p-4 justify-center items-center">
                  <Text className="text-secondary-950">{emptyLabel}</Text>
                </VStack>
              )}
              <FlatList
                scrollEnabled={false}
                bounces={false}
                data={displayUsers}
                keyExtractor={(item) => item.id}
                ItemSeparatorComponent={ListDivider}
                renderItem={({ item }) => (
                  <UserFavoriteItem
                    item={item}
                    isFavorite={favoriteIds.has(item.id)}
                    colorScheme={colorScheme}
                    onToggle={handleToggle}
                  />
                )}
              />
            </ScrollView>
          </VStack>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}

function UserFavoriteItem({
  item,
  isFavorite,
  colorScheme,
  onToggle
}: {
  item: UserPreview;
  isFavorite: boolean;
  colorScheme: "light" | "dark";
  onToggle: (user: UserPreview) => void;
}) {
  return (
    <HStack className="px-4 py-3 items-center gap-x-3">
      <AppAvatar name={item.first_name} uri={item.avatar || ""} size="md" />
      <VStack className="flex-1">
        <Text className="text-lg">
          {item.first_name} {item.last_name}
        </Text>
        <Text className="text-secondary-950">{item.email}</Text>
      </VStack>
      <Pressable hitSlop={8} onPress={() => onToggle(item)}>
        <Heart
          size={22}
          color={
            isFavorite
              ? getPrimaryHex("text-primary-400", colorScheme)
              : getSecondaryHex("text-secondary-950", colorScheme)
          }
          fill={
            isFavorite ? getPrimaryHex("text-primary-400", colorScheme) : "none"
          }
        />
      </Pressable>
    </HStack>
  );
}
