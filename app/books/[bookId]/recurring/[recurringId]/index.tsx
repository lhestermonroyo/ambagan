import AndroidHeaderMenu from "@/components/AndroidHeaderMenu";
import CategoryIcon from "@/components/CategoryIcon";
import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
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
  ModalBackdrop,
  ModalContent,
  ModalFooter,
  ModalHeader
} from "@/components/ui/modal";
import { RefreshControl } from "@/components/ui/refresh-control";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { expenseCategoryMeta } from "@/features/expense/components/CategorySheet";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import {
  endSummary,
  recurrenceSummary
} from "@/features/expense/utils/recurrence.util";
import useAppToast from "@/hooks/use-app-toast";
import { useNetwork } from "@/hooks/useNetwork";
import InnerLayout from "@/layouts/InnerLayout";
import services from "@/services";
import { PersonalRecurring } from "@/types/books";
import {
  RecurrenceEndType,
  RecurrenceFrequency
} from "@/types/expenses";
import { EmptyType } from "@/types/general";
import { getSecondaryHex } from "@/utils/getColorHex";
import * as offlineQueue from "@/utils/offlineQueue";
import { format } from "date-fns";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter
} from "expo-router";
import { Pause, Play, Trash2 } from "lucide-react-native";
import { Fragment, ReactNode, useCallback, useState } from "react";
import { useColorScheme } from "react-native";

/**
 * Read-focused details for a single personal recurring-expense series. Mirrors
 * the group Recurring Details screen but stripped to what a personal book has:
 * no payers, member splits, or "created by" (the series is always the viewer's
 * own). Pause/resume/delete live in the toolbar. RLS scopes every write to the
 * owner regardless.
 */
export default function BookRecurringDetailsScreen() {
  const router = useRouter();
  const { recurringId } = useLocalSearchParams<{
    bookId: string;
    recurringId: string;
  }>();

  const colorScheme = useColorScheme() ?? "light";
  const toast = useAppToast();
  const { isOnline } = useNetwork();

  const [item, setItem] = useState<PersonalRecurring | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!recurringId) return;
    try {
      const recurring =
        await services.bookRecurring.getPersonalRecurringById(recurringId);
      setItem(recurring);
    } catch {
      // Recurring reads aren't cached, so offline they simply fail — that's the
      // offline empty state below, not an error worth a toast.
      if (isOnline) {
        toast({
          title: "Couldn't load",
          description:
            "Failed to load this recurring expense. Please try again.",
          type: "error"
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recurringId, isOnline]);

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

  // Recurring series are server-authoritative (the cron mutates their schedule),
  // so management stays online-only rather than queuing writes that could race a
  // server run. Mirrors the create guard on the Add Expense screen.
  const requireConnection = async () => {
    if (await offlineQueue.isOnline()) return true;
    toast({
      title: "You're offline",
      description:
        "Recurring expenses need a connection. Reconnect to manage this series.",
      type: "info"
    });
    return false;
  };

  const handleToggleActive = async () => {
    if (!item) return;
    if (!(await requireConnection())) return;
    const next = !item.is_active;
    setBusy(true);
    setItem((prev) => (prev ? { ...prev, is_active: next } : prev));
    try {
      await services.bookRecurring.setPersonalRecurringActive(item.id, next);
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
    if (!(await requireConnection())) return;
    setBusy(true);
    try {
      await services.bookRecurring.deletePersonalRecurring(item.id);
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
    if (!item) return undefined;
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

  const renderAndroidActions = (): ReactNode => {
    if (!item) return undefined;
    return (
      <AndroidHeaderMenu
        accessibilityLabel="Recurring options"
        items={[
          {
            key: "toggle",
            label: item.is_active ? "Pause series" : "Resume series",
            icon: item.is_active ? Pause : Play,
            onPress: handleToggleActive
          },
          {
            key: "delete",
            label: "Delete",
            icon: Trash2,
            destructive: true,
            onPress: () => setDeleteModalOpen(true)
          }
        ]}
      />
    );
  };

  const scheduleText = item
    ? recurrenceSummary({
        frequency: item.frequency as RecurrenceFrequency,
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
        androidActions={renderAndroidActions()}
      >
        <LoadingWrapper isLoading={loading} skeleton={<ExpenseDetailsSkeleton />}>
          {!item ? (
            <VStack className="flex-1 py-16">
              <EmptyList
                type={EmptyType.EXPENSE}
                content={
                  isOnline
                    ? "This recurring expense couldn't be loaded. Pull back and try again."
                    : "You're offline. Reconnect to view this recurring expense."
                }
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
                    <DetailRow
                      label="Category"
                      value={
                        <HStack className="gap-x-3 items-center">
                          <CategoryIcon
                            icon={expenseCategoryMeta(item.category).icon}
                          />
                          <Text>{expenseCategoryMeta(item.category).label}</Text>
                        </HStack>
                      }
                    />
                    <RowDivider />
                    <DetailRow
                      label="Schedule"
                      value={<Text>{scheduleText}</Text>}
                    />
                    <RowDivider />
                    <DetailRow
                      label="Ends"
                      value={
                        <Text>
                          {endSummary({
                            end_type: item.end_type as RecurrenceEndType,
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
                  </Box>
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
        <ModalBackdrop />
        <ModalContent>
          <ModalHeader>
            <Heading size="lg">Delete recurring series?</Heading>
          </ModalHeader>
          <ModalBody>
            <Text className="text-sm text-secondary-950">
              Future occurrences won't be posted. Expenses already created stay
              in the book. This can't be undone.
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
