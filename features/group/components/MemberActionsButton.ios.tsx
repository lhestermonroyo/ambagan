import { GroupRole } from "@/types/groups";
import { getSecondaryHex } from "@/utils/getColorHex";
import { Button, Host, Image, Menu } from "@expo/ui/swift-ui";
import { accessibilityLabel, buttonStyle, frame } from "@expo/ui/swift-ui/modifiers";
import type { MemberActionsButtonProps } from "./MemberActionsButton.types";

export default function MemberActionsButton({
  member,
  canManage,
  isOwnerRow,
  colorScheme,
  onViewDetails,
  onSetRole,
  onRemove
}: MemberActionsButtonProps) {
  const isAdmin = member.role === GroupRole.ADMIN;

  return (
    <Host style={{ width: 44, height: 44 }} colorScheme={colorScheme}>
      <Menu
        label={
          <Image
            systemName="ellipsis"
            size={20}
            color={getSecondaryHex("text-secondary-950", colorScheme)}
            modifiers={[frame({ width: 44, height: 44 })]}
          />
        }
        modifiers={[
          buttonStyle("plain"),
          accessibilityLabel(`More options for ${member.first_name}`)
        ]}
      >
        {onViewDetails && (
          <Button
            label="Friend Details"
            systemImage="person"
            onPress={() => onViewDetails(member)}
          />
        )}
        {canManage && !isOwnerRow && (
          <Button
            label={isAdmin ? "Remove admin" : "Make admin"}
            systemImage={isAdmin ? "person.badge.minus" : "person.badge.plus"}
            role={isAdmin ? "destructive" : "default"}
            onPress={() =>
              onSetRole(member, isAdmin ? GroupRole.MEMBER : GroupRole.ADMIN)
            }
          />
        )}
        {canManage && !isOwnerRow && onRemove && (
          <Button
            label="Remove member"
            systemImage="person.crop.circle.badge.minus"
            role="destructive"
            onPress={() => onRemove(member)}
          />
        )}
      </Menu>
    </Host>
  );
}
