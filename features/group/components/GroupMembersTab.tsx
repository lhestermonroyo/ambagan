import AppAvatar from "@/components/AppAvatar";
import EmptyList from "@/components/EmptyList";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import {
  groupAdmins,
  groupNonAdmins,
  isGroupAdmin,
  isGroupOwner
} from "@/features/group/utils/groupRoles";
import useAppToast from "@/hooks/use-app-toast";
import { useEnsureOnline } from "@/hooks/useEnsureOnline";
import services from "@/services";
import states from "@/states";
import { EmptyType } from "@/types/general";
import { GroupRole, Member } from "@/types/groups";
import { getUserSubtitle } from "@/utils/userDisplay";
import { useRouter } from "expo-router";
import { Fragment, useMemo, useState } from "react";
import { Platform, useColorScheme } from "react-native";
import EditMembersSheet from "./EditMemberSheet";
import MemberActionsButton from "./MemberActionsButton";
import MemberActionsSheet from "./MemberActionsSheet";

/**
 * The group's roster, on its own tab.
 *
 * Split out of {@link GroupDetailsTab} once co-admins shipped: that tab was
 * carrying six read-once metadata rows AND a list that grows with the group, so
 * seeing who was in a 12-person group meant scrolling past the currency and the
 * created-at date every time.
 *
 * One list shows the owner, co-admins, then members. Role badges sit beside
 * each row's ellipsis menu, with contact details underneath the name.
 */
export default function GroupMembersTab() {
  const { details, memberList } = states.group();
  const { details: userDetails } = states.user();
  const showToast = useAppToast();
  const ensureOnline = useEnsureOnline();

  const router = useRouter();
  const colorScheme: "light" | "dark" =
    useColorScheme() === "dark" ? "dark" : "light";

  const [isEditMembersOpen, setIsEditMembersOpen] = useState(false);
  /** The row whose ellipsis was tapped; null while the menu is closed. */
  const [actionMember, setActionMember] = useState<Member | null>(null);
  /** Ids whose role write is in flight. A set, not a single id: every row has
   *  its own menu, so two promotions can legitimately overlap and each row has
   *  to show its own progress. */
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  // Any admin edits the roster; only the owner hands out admin.
  const isAdmin = isGroupAdmin(details, memberList, userDetails?.id);
  const isOwner = isGroupOwner(details, userDetails?.id);

  // Owner pinned first — they outrank the co-admins below them and can't be
  // demoted, so they read as the head of the list rather than one of the rows.
  const roster = useMemo(() => {
    if (!details) return [];

    const ownerId = details.admin.id;
    // Include the owner even when an older cache lacks their membership row.
    const owner: Member =
      memberList.find((m) => m.id === ownerId) ??
      ({
        ...details.admin,
        id: ownerId,
        group_id: details.id,
        joined_at: details.created_at
      } as Member);

    return [
      owner,
      ...groupAdmins(details, memberList).filter((m) => m.id !== ownerId),
      ...groupNonAdmins(details, memberList)
    ];
  }, [details, memberList]);

  if (!details) return null;

  const handleSetRole = async (member: Member, role: GroupRole) => {
    const promoting = role === GroupRole.ADMIN;

    // Dismiss the fallback sheet before showing the result toast. The iOS
    // menu dismisses itself when an action is selected.
    setActionMember(null);

    // A permission change has no safe optimistic story — a queued promotion
    // could land after the person was removed from the group — so this follows
    // the invite-link rule and stays online-only.
    if (
      !(await ensureOnline(
        "Changing who can manage this group needs an internet connection. Please try again when you're back online."
      ))
    ) {
      return;
    }

    setPendingIds((prev) => new Set(prev).add(member.id));
    try {
      await services.member.setMemberRole(details.id, member.id, role);

      states.group.setState((prev) => ({
        ...prev,
        memberList: prev.memberList.map((m) =>
          m.id === member.id ? { ...m, role } : m
        )
      }));

      showToast({
        title: promoting ? "Admin added" : "Admin removed",
        description: promoting
          ? `${member.first_name} can now add and remove members and share the invite link.`
          : `${member.first_name} is now a regular member.`,
        type: "success"
      });
    } catch (error) {
      console.error("Error updating member role:", error);
      showToast({
        title: "Couldn't update admins",
        description: "Please check your connection and try again.",
        type: "error"
      });
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(member.id);
        return next;
      });
    }
  };

  const handleViewDetails = (member: Member) => {
    setActionMember(null);
    router.push({
      pathname: "/friends/[friendId]",
      params: {
        friendId: member.id,
        name: `${member.first_name} ${member.last_name}`,
        email: member.email ?? "",
        avatar: member.avatar || ""
      }
    });
  };

  return (
    <Fragment>
      <VStack className="gap-y-4 px-4">
        <HStack className="items-center gap-x-2">
          <Text bold className="text-xl flex-1">
            {roster.length} {roster.length === 1 ? "person" : "people"}
          </Text>
          {isAdmin && (
            <Button variant="link" onPress={() => setIsEditMembersOpen(true)}>
              <Text className="text-primary-400 font-medium">Edit</Text>
            </Button>
          )}
        </HStack>

        <FlatList
          scrollEnabled={false}
          data={roster}
          keyExtractor={(item) => (item as Member).id.toString()}
          renderItem={({ item }) => (
            <MemberRow
              item={item as Member}
              ownerId={details.admin.id}
              pending={pendingIds.has((item as Member).id)}
              colorScheme={colorScheme}
              canManage={isOwner}
              onOpenActions={setActionMember}
              onViewDetails={handleViewDetails}
              onSetRole={handleSetRole}
            />
          )}
          ItemSeparatorComponent={() => (
            <Divider className="border-secondary-100" />
          )}
          ListEmptyComponent={() => <EmptyList type={EmptyType.MEMBER} />}
        />
      </VStack>

      <EditMembersSheet
        isOpen={isEditMembersOpen}
        onClose={() => setIsEditMembersOpen(false)}
      />
      {Platform.OS !== "ios" && (
        <MemberActionsSheet
          isOpen={!!actionMember}
          onClose={() => setActionMember(null)}
          member={actionMember}
          canManage={isOwner}
          isOwnerRow={actionMember?.id === details.admin.id}
          onViewDetails={handleViewDetails}
          onSetRole={handleSetRole}
        />
      )}
    </Fragment>
  );
}

/**
 * One roster row. The trailing control is an ellipsis for everyone except
 * yourself. iOS uses a native dropdown; other platforms open the action sheet.
 */
function MemberRow({
  item,
  ownerId,
  pending,
  colorScheme,
  canManage,
  onOpenActions,
  onViewDetails,
  onSetRole
}: {
  item: Member;
  ownerId: string;
  pending: boolean;
  colorScheme: "light" | "dark";
  canManage: boolean;
  onOpenActions: (member: Member) => void;
  onViewDetails: (member: Member) => void;
  onSetRole: (member: Member, role: GroupRole) => void;
}) {
  const { details: userDetails } = states.user();

  const isYou = item.id === userDetails?.id;
  const isOwnerRow = item.id === ownerId;
  const isAdminRow = isOwnerRow || item.role === GroupRole.ADMIN;
  const roleLabel = isOwnerRow ? "Owner" : "Admin";
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
            className={`text-xs normal-case ${
              isOwnerRow ? "text-primary-600" : "text-secondary-950"
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
          />
        )
      )}
    </HStack>
  );
}
