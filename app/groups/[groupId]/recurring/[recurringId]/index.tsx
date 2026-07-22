import AppAvatar from "@/components/AppAvatar";
import EmptyList from "@/components/EmptyList";
import LoadingWrapper from "@/components/LoadingWrapper";
import { ExpenseDetailsSkeleton } from "@/components/SkeletonLoader";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader
} from "@/components/ui/modal";
import { RefreshControl } from "@/components/ui/refresh-control";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import FormButton from "@/components/FormButton";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import {
  endSummary,
  recurrenceSummary
} from "@/features/expense/utils/recurrence.util";
import useAppToast from "@/hooks/use-app-toast";
import InnerLayout from "@/layouts/InnerLayout";
import services from "@/services";
import states from "@/states";
import { RecurringExpense, SplitType } from "@/types/expenses";
import { EmptyType } from "@/types/general";
import { Member } from "@/types/groups";
import { getSecondaryHex } from "@/utils/getColorHex";
import { getUserSubtitle } from "@/utils/userDisplay";
import { format } from "date-fns";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter
} from "expo-router";
import { Fragment, ReactNode, useCallback, useMemo, useState } from "react";
import { useColorScheme } from "react-native";

/**
 * Read-focused details for a single recurring-expense series — mirrors the
 * one-time Expense Details layout (header amount, a details card, Payers +
 * Member Splits) but adds the recurrence block (schedule, next/last run,
 * occurrences). The template stores who-paid / who-owes as `userId` snapshots,
 * so we resolve them against the group's member list for avatars and names.
 *
 * Series management (pause/resume/delete) lives here in the toolbar for the
 * creator, matching how the one-time expense screen owns edit/delete — the
 * GroupRecurring list just navigates here.
 */
export default function RecurringDetailsScreen() {
  const router = useRouter();
  const { groupId, recurringId } = useLocalSearchParams<{
    groupId: string;
    recurringId: string;
  }>();

  const colorScheme = useColorScheme() ?? "light";
  const toast = useAppToast();

  const { details: currentUser } = states.user();
  const { memberList } = states.group();
  const userId = currentUser?.id;

  const [item, setItem] = useState<RecurringExpense | null>(null);
  const [members, setMembers] = useState<Member[]>(memberList);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!recurringId) return;
    try {
      const [recurring, groupMembers] = await Promise.all([
        services.expense.getRecurringById(recurringId),
        // Snapshots hold userIds only; make sure we can resolve them even on a
        // cold deep-link where group state isn't populated yet.
        memberList.length
          ? Promise.resolve(memberList)
          : services.member.getMembersByGroupId(groupId).catch(() => [])
      ]);
      setItem(recurring);
      if (groupMembers.length) setMembers(groupMembers);
    } catch {
      toast({
        title: "Couldn't load",
        description: "Failed to load this recurring expense. Please try again.",
        type: "error"
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recurringId, groupId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const memberById = useMemo(() => {
    const map = new Map<string, Member>();
    members.forEach((m) => map.set(m.id, m));
    return map;
  }, [members]);

  const isOwner = item?.creator?.id === userId;

  const handleToggleActive = async () => {
    if (!item) return;
    const next = !item.is_active;
    setBusy(true);
    setItem((prev) => (prev ? { ...prev, is_active: next } : prev));
    try {
      await services.expense.setRecurringActive(item.id, next);
      toast({
        title: next ? "Series resumed" : "Series paused",
        description: next
          ? "Future occurrences will post on schedule again."
          : "No new occurrences will post until you resume.",
        type: "success"
      });
    } catch {
      setItem((prev) => (prev ? { ...prev, is_active: !next } : prev));
      toast({
        title: "Couldn't update",
        description: "Failed to change this series. Please try again.",
        type: "error"
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    setBusy(true);
    try {
      await services.expense.deleteRecurringExpense(item.id);
      toast({
        title: "Series deleted",
        description: "Future occurrences won't be posted. Past ones remain.",
        type: "success"
      });
      setDeleteModalOpen(false);
      router.back();
    } catch {
      toast({
        title: "Couldn't delete",
        description: "Failed to delete this series. Please try again.",
        type: "error"
      });
    } finally {
      setBusy(false);
    }
  };

  const renderActions = (): ReactNode => {
    if (!isOwner || !item) return undefined;
    return (
      <Stack.Toolbar.Menu
        icon="ellipsis"
        tintColor={getSecondaryHex("text-secondary-950", colorScheme)}
        accessibilityLabel="Recurring options"
      >
        <Stack.Toolbar.MenuAction
          icon={item.is_active ? "pause" : "play"}
          onPress={handleToggleActive}
        >
          {item.is_active ? "Pause series" : "Resume series"}
        </Stack.Toolbar.MenuAction>
        <Stack.Toolbar.MenuAction
          icon="trash"
          destructive
          onPress={() => setDeleteModalOpen(true)}
        >
          Delete
        </Stack.Toolbar.MenuAction>
      </Stack.Toolbar.Menu>
    );
  };

  const scheduleText = item
    ? recurrenceSummary({
        frequency: item.frequency,
        repeat_interval: item.repeat_interval
      })
    : "";

  const occurrencesText = item
    ? item.occurrence_limit != null
      ? `${item.occurrences_count} of ${item.occurrence_limit}`
      : `${item.occurrences_count}`
    : "";

  return (
    <Fragment>
      <InnerLayout
        title="Recurring Details"
        onBack={() => router.back()}
        actions={renderActions()}
      >
        <LoadingWrapper isLoading={loading} skeleton={<ExpenseDetailsSkeleton />}>
          {!item ? (
            <VStack className="flex-1 py-16">
              <EmptyList
                type={EmptyType.EXPENSE}
                content="This recurring expense couldn't be loaded. Pull back and try again."
              />
            </VStack>
          ) : (
            <ScrollView
              className="flex-1"
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                />
              }
            >
              <VStack className="gap-y-6 py-4">
                <VStack className="w-full gap-y-1 px-4">
                  <HStack className="items-center gap-x-2">
                    <Text
                      className="text-sm text-secondary-950 uppercase flex-1"
                      bold
                      numberOfLines={1}
                    >
                      {item.description}
                    </Text>
                    <Badge
                      size="sm"
                      variant="solid"
                      className={`rounded-full px-3 ${
                        item.is_active ? "bg-success-50" : "bg-background-200"
                      }`}
                    >
                      <BadgeText
                        className={`font-bold text-xs uppercase ${
                          item.is_active
                            ? "text-success-600"
                            : "text-typography-700"
                        }`}
                      >
                        {item.is_active ? "Active" : "Paused"}
                      </BadgeText>
                    </Badge>
                  </HStack>
                  <Text className="text-3xl" bold>
                    {formatAmount(item.amount, item.currency)}
                  </Text>
                </VStack>

                <VStack className="gap-y-2">
                  <Box className="bg-secondary-100 mx-4 rounded-xl overflow-hidden">
                    <DetailRow label="Schedule" value={<Text>{scheduleText}</Text>} />
                    <RowDivider />
                    <DetailRow
                      label="Ends"
                      value={
                        <Text>
                          {endSummary({
                            end_type: item.end_type,
                            end_date: item.end_date,
                            occurrence_limit: item.occurrence_limit
                          })}
                        </Text>
                      }
                    />
                    <RowDivider />
                    <DetailRow
                      label="Start Date"
                      value={
                        <Text>
                          {format(new Date(item.start_date), "MMM d, yyyy")}
                        </Text>
                      }
                    />
                    {item.is_active && (
                      <>
                        <RowDivider />
                        <DetailRow
                          label="Next Occurrence"
                          value={
                            <Text>
                              {format(
                                new Date(item.next_run_at),
                                "MMM d, yyyy"
                              )}
                            </Text>
                          }
                        />
                      </>
                    )}
                    <RowDivider />
                    <DetailRow
                      label="Last Posted"
                      value={
                        <Text>
                          {item.last_run_at
                            ? format(new Date(item.last_run_at), "MMM d, yyyy")
                            : "Not yet"}
                        </Text>
                      }
                    />
                    <RowDivider />
                    <DetailRow
                      label="Occurrences Posted"
                      value={<Text>{occurrencesText}</Text>}
                    />
                    <RowDivider />
                    <DetailRow
                      label="Split Type"
                      value={<Text className="capitalize">{item.split_type}</Text>}
                    />
                    <RowDivider />
                    <DetailRow
                      label="Created By"
                      value={
                        <HStack className="gap-x-2 items-center">
                          <AppAvatar
                            name={`${item.creator.first_name} ${item.creator.last_name}`}
                            uri={item.creator.avatar!}
                            size="sm"
                          />
                          <Text>
                            {item.creator.first_name} {item.creator.last_name}
                            {item.creator.id === userId && " (You)"}
                          </Text>
                        </HStack>
                      }
                    />
                  </Box>
                </VStack>

                <VStack className="gap-y-2">
                  <Text className="text-xl px-4" bold>
                    Payers
                  </Text>
                  <SnapshotList
                    rows={item.payers_snapshot.map((p) => ({
                      userId: p.userId,
                      amount: p.amount,
                      currency: item.currency
                    }))}
                    memberById={memberById}
                    currentUserId={userId}
                  />
                </VStack>

                <VStack className="gap-y-2">
                  <Text className="text-xl px-4" bold>
                    Member Splits
                  </Text>
                  <SnapshotList
                    rows={item.splits_snapshot.map((s) => ({
                      userId: s.userId,
                      amount: s.amount,
                      currency: item.currency,
                      percentage:
                        item.split_type === SplitType.PERCENTAGE
                          ? s.percentage
                          : undefined
                    }))}
                    memberById={memberById}
                    currentUserId={userId}
                  />
                </VStack>

                <Box className="h-8" />
              </VStack>
            </ScrollView>
          )}
        </LoadingWrapper>
      </InnerLayout>

      <Modal
        isOpen={deleteModalOpen}
        onClose={() => !busy && setDeleteModalOpen(false)}
      >
        <ModalContent>
          <ModalHeader>
            <Heading size="lg">Delete recurring series?</Heading>
          </ModalHeader>
          <ModalBody>
            <Text className="text-sm text-secondary-950">
              Future occurrences won't be posted. Expenses already created stay
              in the group. This can't be undone.
            </Text>
          </ModalBody>
          <ModalFooter>
            <HStack className="gap-x-2">
              <FormButton
                variant="outline"
                text="Cancel"
                disabled={busy}
                onPress={() => setDeleteModalOpen(false)}
              />
              <FormButton
                text="Delete"
                action="negative"
                loading={busy}
                onPress={handleDelete}
              />
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Fragment>
  );
}

function RowDivider() {
  return (
    <Box className="mx-4">
      <Divider className="border-secondary-200" />
    </Box>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <HStack className="items-center justify-between p-4">
      <Text className="text-secondary-950">{label}</Text>
      {value}
    </HStack>
  );
}

type SnapshotRow = {
  userId: string;
  amount: number;
  currency: string;
  percentage?: number;
};

function SnapshotList({
  rows,
  memberById,
  currentUserId
}: {
  rows: SnapshotRow[];
  memberById: Map<string, Member>;
  currentUserId?: string;
}) {
  if (!rows.length) {
    return <EmptyList type={EmptyType.MEMBER} />;
  }

  // Surface the current user first, mirroring the one-time expense screen.
  const sorted = [...rows].sort((a, b) => {
    if (a.userId === currentUserId) return -1;
    if (b.userId === currentUserId) return 1;
    return 0;
  });

  return (
    <VStack>
      {sorted.map((row, index) => {
        const member = memberById.get(row.userId);
        const isMe = row.userId === currentUserId;
        const name = member
          ? `${member.first_name} ${member.last_name}`
          : "Former member";
        return (
          <Fragment key={row.userId}>
            {index > 0 && (
              <Box className="mx-4">
                <Divider className="border-background-100" />
              </Box>
            )}
            <Box className="p-4">
              <HStack className="items-center gap-x-2">
                <AppAvatar
                  name={member?.first_name ?? "?"}
                  uri={member?.avatar ?? undefined}
                  size="md"
                  isPlaceholder={member?.is_placeholder}
                />
                <VStack className="flex-1">
                  <Text className="text-lg">
                    {name}
                    {isMe && " (You)"}
                  </Text>
                  {member && (
                    <Text className="text-sm text-secondary-950">
                      {getUserSubtitle(member)}
                    </Text>
                  )}
                </VStack>
                <VStack className="items-end">
                  <Text className="text-lg">
                    {formatAmount(row.amount, row.currency)}
                  </Text>
                  {row.percentage != null && (
                    <Text className="text-sm text-secondary-950">
                      {row.percentage}%
                    </Text>
                  )}
                </VStack>
              </HStack>
            </Box>
          </Fragment>
        );
      })}
    </VStack>
  );
}
