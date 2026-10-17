import AppAvatar from "@/components/AppAvatar";
import { Badge, BadgeText } from "@/components/ui/badge";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import useUserStore from "@/features/user/states/user.state";
import { GroupRole, Member } from "@/types/groups";
import { getUserSubtitle } from "@/utils/userDisplay";
import MemberActionsButton from "./MemberActionsButton";

/**
 * One roster row. The trailing control is an ellipsis for everyone except
 * yourself. iOS uses a native dropdown; other platforms open the action sheet.
 */
export default function GroupMemberRow({
  item,
  ownerId,
  pending,
  colorScheme,
  canManage,
  onOpenActions,
  onViewDetails,
  onSetRole,
  onRemove
}: {
  item: Member;
  ownerId: string;
  pending: boolean;
  colorScheme: "light" | "dark";
  canManage: boolean;
  onOpenActions: (member: Member) => void;
  onViewDetails?: (member: Member) => void;
  onSetRole: (member: Member, role: GroupRole) => void;
  onRemove?: (member: Member) => void;
}) {
  const { details: userDetails } = useUserStore();

  const isYou = item.id === userDetails?.id;
  const isOwnerRow = item.id === ownerId;
  const isAdminRow = isOwnerRow || item.role === GroupRole.ADMIN;
  const roleLabel = isOwnerRow ? "OWNER" : "ADMIN";
  const subtitle = getUserSubtitle(item);

  return (
    <HStack className="items-center py-4 gap-x-3">
      <AppAvatar
        name={item.first_name}
        uri={item.avatar!}
        size="md"
        isPlaceholder={item.is_placeholder}
      />
      <VStack className="flex-1 min-w-0">
        <Text className="text-lg" numberOfLines={1}>
          {item.first_name} {item.last_name}
          {isYou && " (You)"}
        </Text>
        {!!subtitle && (
          <Text className="text-sm text-secondary-950" numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </VStack>

      {isAdminRow && (
        <Badge
          size="sm"
          className={`rounded-full shrink-0 ${
            isOwnerRow ? "bg-primary-100" : "bg-secondary-100"
          }`}
        >
          <BadgeText
            numberOfLines={1}
            className={`text-xs uppercase shrink-0 ${
              isOwnerRow ? "text-primary-600 dark:text-primary-800" : "text-secondary-950 dark:text-typography-700"
            }`}
          >
            {roleLabel}
          </BadgeText>
        </Badge>
      )}

      {pending ? (
        <Text className="text-sm text-secondary-950">Saving…</Text>
      ) : (
        // Nothing in the menu applies to your own row: Friend Details on
        // yourself is meaningless, and nobody can change their own role.
        !isYou && (
          <MemberActionsButton
            member={item}
            canManage={canManage}
            isOwnerRow={isOwnerRow}
            colorScheme={colorScheme}
            onOpenActions={onOpenActions}
            onViewDetails={onViewDetails}
            onSetRole={onSetRole}
            onRemove={onRemove}
          />
        )
      )}
    </HStack>
  );
}
