import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { useRouter } from "expo-router";

/**
 * Shared header for the settlement sheets (Mark as Settled / Request as Settled
 * / Review Settlement). Renders the back-to-close title on the left and a
 * compact "Group" pill on the right that jumps to the group settlement screen.
 *
 * The pill replaces the old intermediate SettlementActionSheet's "Open Group
 * Settlement" button: settlements now open their action sheet directly, with the
 * group jump living here as a secondary action.
 */
export default function SettlementSheetHeader({
  title,
  onClose,
  groupId,
  showGroupLink = true
}: {
  title: string;
  onClose: () => void;
  groupId?: string;
  /** Hide the "View Group" jump when the sheet is already opened from within
   *  the group's own settlement screen — it's only useful from Overview and
   *  Friend Details, where you're not already looking at the group. */
  showGroupLink?: boolean;
}) {
  const router = useRouter();

  const handleOpenGroup = () => {
    onClose();
    if (groupId) router.push(`/groups/${groupId}`);
  };

  return (
    <HStack className="p-4 items-center justify-between">
      <Pressable onPress={onClose}>
        <HStack className="items-center">
          <Icon as="arrow-back-ios" className="text-secondary-950" />
          <Text bold className="text-xl">
            {title}
          </Text>
        </HStack>
      </Pressable>

      {showGroupLink && groupId && (
        <FormButton
          variant="outline"
          size="md"
          text="View Group"
          iconEnd={
            <Icon as="chevron-right" className="text-primary-400 -ml-2 -mr-1" />
          }
          onPress={handleOpenGroup}
        />
      )}
    </HStack>
  );
}
