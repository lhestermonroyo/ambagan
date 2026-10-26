import { Pressable } from "@/components/ui/pressable";
import { getSecondaryHex } from "@/utils/getColorHex";
import { Ellipsis } from "lucide-react-native";
import type { MemberActionsButtonProps } from "./MemberActionsButton.types";

export default function MemberActionsButton({
  member,
  colorScheme,
  onOpenActions
}: MemberActionsButtonProps) {
  return (
    <Pressable
      aria-label={`More options for ${member.first_name}`}
      hitSlop={8}
      onPress={() => onOpenActions(member)}
    >
      <Ellipsis
        size={20}
        color={getSecondaryHex("text-secondary-950", colorScheme)}
      />
    </Pressable>
  );
}
