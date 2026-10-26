import AppAvatar from "@/components/AppAvatar";
import ListDivider from "@/components/ListDivider";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetFlatList,
  ActionsheetItem,
  ActionsheetItemText
} from "@/components/ui/actionsheet";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { GroupRole, Member } from "@/types/groups";
import { getErrorHex, getSecondaryHex } from "@/utils/getColorHex";
import { getUserSubtitle } from "@/utils/userDisplay";
import {
  LucideIcon,
  ShieldOff,
  ShieldPlus,
  UserRound,
  UserRoundMinus
} from "lucide-react-native";
import { useMemo } from "react";
import { useColorScheme } from "react-native";

type ActionItem = {
  key: string;
  icon: LucideIcon;
  iconColor: string;
  label: string;
  destructive?: boolean;
  onPress: () => void;
};

/**
 * The per-row menu on the group's Members tab — opened by the row's ellipsis.
 *
 * Always offers Friend Details; adds the role toggle only for the group OWNER,
 * and never on the owner's own row (ownership moves by transfer when they
 * leave, not by demotion). Which is to say the sheet's contents mirror what
 * `set_group_member_role()` will actually allow, rather than offering an action
 * that would come back as an error.
 */
export default function MemberActionsSheet({
  isOpen,
  onClose,
  member,
  canManage,
  isOwnerRow,
  onViewDetails,
  onSetRole,
  onRemove
}: {
  isOpen: boolean;
  onClose: () => void;
  /** The row's member. Null while the sheet is closed. */
  member: Member | null;
  /** True for the group owner — the only person who may change a role. */
  canManage: boolean;
  /** True when this row IS the owner's. */
  isOwnerRow: boolean;
  onViewDetails?: (member: Member) => void;
  onSetRole: (member: Member, role: GroupRole) => void;
  onRemove?: (member: Member) => void;
}) {
  const colorScheme = useColorScheme() ?? "light";

  const isAdminRow = isOwnerRow || member?.role === GroupRole.ADMIN;

  const items: ActionItem[] = useMemo(() => {
    if (!member) return [];

    const list: ActionItem[] = [];
    if (onViewDetails) {
      list.push({
        key: "details",
        icon: UserRound,
        iconColor: getSecondaryHex("text-secondary-950", colorScheme),
        label: "Friend Details",
        onPress: () => onViewDetails(member)
      });
    }

    if (canManage && !isOwnerRow) {
      list.push(
        isAdminRow
          ? {
              key: "demote",
              icon: ShieldOff,
              iconColor: getErrorHex("text-error-600", colorScheme),
              label: "Remove Admin",
              destructive: true,
              onPress: () => onSetRole(member, GroupRole.MEMBER)
            }
          : {
              key: "promote",
              icon: ShieldPlus,
              iconColor: getSecondaryHex("text-secondary-950", colorScheme),
              label: "Make Admin",
              onPress: () => onSetRole(member, GroupRole.ADMIN)
            }
      );
    }

    if (canManage && !isOwnerRow && onRemove) {
      list.push({
        key: "remove",
        icon: UserRoundMinus,
        iconColor: getErrorHex("text-error-600", colorScheme),
        label: "Remove Member",
        destructive: true,
        onPress: () => onRemove(member)
      });
    }

    return list;
  }, [
    member,
    canManage,
    isOwnerRow,
    isAdminRow,
    colorScheme,
    onViewDetails,
    onSetRole,
    onRemove
  ]);

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="px-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full gap-y-4">
          {/* Whose menu this is — the ellipsis that opened it sits in a list of
              near-identical rows, so the sheet has to say. */}
          <HStack className="items-center gap-x-3 px-4">
            <AppAvatar
              name={member?.first_name ?? ""}
              uri={member?.avatar ?? ""}
              size="md"
              isPlaceholder={member?.is_placeholder}
            />
            <VStack className="flex-1">
              <Text bold className="text-lg">
                {member?.first_name} {member?.last_name}
              </Text>
              <Text className="text-sm text-secondary-950">
                {isOwnerRow
                  ? "Owner"
                  : isAdminRow
                    ? "Admin"
                    : member
                      ? getUserSubtitle(member)
                      : ""}
              </Text>
            </VStack>
          </HStack>

          <ActionsheetFlatList
            data={items}
            keyExtractor={(item) => (item as ActionItem).key}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <ListDivider />}
            renderItem={({ item }) => {
              const {
                icon: Icon,
                iconColor,
                label,
                destructive,
                onPress
              } = item as ActionItem;

              return (
                <ActionsheetItem onPress={onPress}>
                  <HStack className="items-center gap-x-2 flex-1">
                    <Icon color={iconColor} />
                    <ActionsheetItemText
                      className={`text-lg font-semibold ${
                        destructive ? "text-error-600" : ""
                      }`}
                    >
                      {label}
                    </ActionsheetItemText>
                  </HStack>
                </ActionsheetItem>
              );
            }}
          />
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
