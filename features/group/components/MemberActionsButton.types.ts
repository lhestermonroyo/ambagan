import { GroupRole, Member } from "@/types/groups";

export type MemberActionsButtonProps = {
  member: Member;
  canManage: boolean;
  isOwnerRow: boolean;
  colorScheme: "light" | "dark";
  onOpenActions: (member: Member) => void;
  onViewDetails: (member: Member) => void;
  onSetRole: (member: Member, role: GroupRole) => void;
};
