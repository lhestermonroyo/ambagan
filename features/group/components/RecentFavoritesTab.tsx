import FormButton from "@/components/FormButton";
import { HStack } from "@/components/ui/hstack";

export default function RecentFavoritesTab({
  tab,
  onTabChange
}: {
  tab: "friends" | "favorites";
  onTabChange: (tab: "friends" | "favorites") => void;
}) {
  return (
    <HStack className="gap-x-2 px-4">
      <FormButton
        size="sm"
        variant={tab === "friends" ? "solid" : "outline"}
        className="flex-1 h-10"
        text="Friends"
        onPress={() => onTabChange("friends")}
      />
      <FormButton
        size="sm"
        variant={tab === "favorites" ? "solid" : "outline"}
        className="flex-1 h-10"
        text="Favorites"
        onPress={() => onTabChange("favorites")}
      />
    </HStack>
  );
}
