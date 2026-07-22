import AppAvatar from "@/components/AppAvatar";
import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import ListDivider from "@/components/ListDivider";
import LoadingWrapper from "@/components/LoadingWrapper";
import { ExpenseDetailsSkeleton } from "@/components/SkeletonLoader";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Menu, MenuItem, MenuItemLabel } from "@/components/ui/menu";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader
} from "@/components/ui/modal";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import ImageViewerSheet from "@/features/expense/components/ImageViewerSheet";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import useAppToast from "@/hooks/use-app-toast";
import { useNetwork } from "@/hooks/useNetwork";
import InnerLayout from "@/layouts/InnerLayout";
import services from "@/services";
import states from "@/states";
import {
  Expense,
  ExpensePayer,
  MemberSplit,
  Payment,
  SplitType
} from "@/types/expenses";
import { EmptyType } from "@/types/general";
import { cacheService } from "@/utils/cacheService";
import { formatDate } from "@/utils/formatDate";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import { getUserSubtitle } from "@/utils/userDisplay";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter
} from "expo-router";
import { FileImage } from "lucide-react-native";
import { Fragment, ReactNode, useMemo, useState } from "react";
import { useColorScheme } from "react-native";

export default function ExpenseDetailsScreen() {
  const { details: groupDetails } = states.group();
  const {
    details: expenseDetails,
    payerList,
    memberSplitList,
    paymentSplitList
  } = states.expense();
  const { details: userDetails } = states.user();

  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const { isOnline } = useNetwork();
  const params = useLocalSearchParams();
  const expenseId = params.expenseId as string;
  const groupId = params.groupId as string;

  const toast = useAppToast();
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Whether the initial load has settled (server fetch + cache fallback). Kept
  // separate from the presence of `expenseDetails` so the skeleton stops even
  // when nothing could be resolved (e.g. an offline-created expense not yet
  // synced with no cached snapshot) instead of spinning forever.
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useMemo(
      () => () => {
        if (!expenseId || !groupId) {
          return router.replace(`/groups/${groupId}`);
        }

        init(groupId, expenseId);
      },
      [expenseId, groupId]
    )
  );

  const init = async (groupId: string, expenseId: string) => {
    try {
      await runInit(groupId, expenseId);
    } finally {
      // Load has settled — stop the skeleton regardless of what resolved.
      setLoading(false);
    }
  };

  const runInit = async (groupId: string, expenseId: string) => {
    const requests: Promise<void>[] = [
      fetchExpenseDetails(expenseId),
      fetchPayers(expenseId),
      fetchMemberSplits(expenseId),
      fetchPayments(expenseId)
    ];

    if (!groupDetails) {
      requests.push(fetchGroupDetails(groupId));
    }

    await Promise.all(requests);

    const state = states.expense.getState();
    if (state.details?.id === expenseId) {
      // Online fetch succeeded — warm the cache for offline use.
      cacheService
        .saveExpenseDetail(
          expenseId,
          state.details,
          state.payerList,
          state.memberSplitList,
          state.paymentSplitList
        )
        .catch(() => {});
    } else {
      // Online fetch failed (offline) — hydrate from cache.
      try {
        const cached = await cacheService.getExpenseDetail(expenseId);
        if (cached) {
          states.expense.setState((prev) => ({
            ...prev,
            details: cached.expense as Expense,
            payerList: cached.payerList as ExpensePayer[],
            memberSplitList: cached.memberSplits as MemberSplit[],
            paymentSplitList: cached.paymentSplits as Payment[]
          }));
        } else {
          // Full detail cache missing (e.g. offline-added expense not yet synced).
          // Build a partial Expense from the ExpensePreview in group state/cache.
          const preview =
            states.group
              .getState()
              .expenseList.find((e) => e.id === expenseId) ??
            (
              await cacheService.getGroupDetail(groupId).catch(() => null)
            )?.expenseList.find((e: any) => e.id === expenseId);

          if (preview) {
            states.expense.setState((prev) => ({
              ...prev,
              details: {
                ...preview,
                split_type: (preview as any).split_type ?? SplitType.EQUAL,
                expense_date:
                  (preview as any).expense_date ?? preview.created_at,
                proof_of_payment: (preview as any).proof_of_payment ?? null
              } as Expense,
              payerList: preview.payer_list ?? [],
              memberSplitList: [],
              paymentSplitList: []
            }));
          }
        }
      } catch {}
    }
  };

  const fetchGroupDetails = async (groupId: string) => {
    try {
      const response = await services.group.getGroupById(groupId);

      if (!response) {
        router.replace("/groups");
        return;
      }

      states.group.setState((prev) => ({
        ...prev,
        details: response
      }));
    } catch (error) {
      console.log("Error fetching group details (offline):", error);
      // Offline fallback: check live list state, then the groups list cache.
      const fromList = states.group
        .getState()
        .list.find((g) => g.id === groupId);
      if (fromList) {
        states.group.setState((prev) => ({ ...prev, details: fromList }));
        return;
      }
      const userId = states.user.getState().details?.id;
      if (userId) {
        const cachedList = await cacheService
          .getGroupsList(userId)
          .catch(() => null);
        const cachedGroup = (cachedList ?? []).find(
          (g: any) => g.id === groupId
        );
        if (cachedGroup) {
          states.group.setState((prev) => ({ ...prev, details: cachedGroup }));
          return;
        }
      }
      router.replace("/groups");
    }
  };

  const fetchExpenseDetails = async (expenseId: string) => {
    try {
      const response = await services.expense.getExpenseById(expenseId);
      if (!response) return;
      states.expense.setState((prev) => ({ ...prev, details: response }));
    } catch (error) {
      console.log("Error fetching expense details:", error);
    }
  };

  const fetchPayers = async (expenseId: string) => {
    try {
      const response = await services.expense.getPayersByExpenseId(expenseId);
      if (!response) return;
      states.expense.setState((prev) => ({ ...prev, payerList: response }));
    } catch (error) {
      console.log("Error fetching payers:", error);
    }
  };

  const fetchMemberSplits = async (expenseId: string) => {
    try {
      const response =
        await services.expense.getMemberSplitsByExpenseId(expenseId);
      if (!response) return;
      states.expense.setState((prev) => ({
        ...prev,
        memberSplitList: response
      }));
    } catch (error) {
      console.log("Error fetching member splits:", error);
    }
  };

  const fetchPayments = async (expenseId: string) => {
    try {
      const response = await services.expense.getPaymentsByExpenseId(expenseId);
      if (!response) return;
      states.expense.setState((prev) => ({
        ...prev,
        paymentSplitList: response
      }));
    } catch (error) {
      console.log("Error fetching payments:", error);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    setDeleting(true);
    try {
      const deleteResponse = await services.expense.deleteExpense(
        expenseId,
        groupId
      );

      if (deleteResponse.success) {
        toast({
          title: "Expense Deleted",
          description: "Expense deleted successfully.",
          type: "success"
        });
        states.expense.setState((prev) => ({
          ...prev,
          details: null,
          payerList: [],
          memberSplitList: [],
          paymentSplitList: []
        }));
        // Removes this expense's payments — bump the refresh token so the
        // mounted Settlements tab drops them instead of showing stale rows.
        states.group.setState((prev) => ({
          ...prev,
          settlementRefreshToken: prev.settlementRefreshToken + 1
        }));
        setDeleteModalOpen(false);
        router.back();
      }
    } catch (error) {
      console.log("Error deleting expense:", error);
      toast({
        title: "Error",
        description: "Failed to delete expense. Please try again.",
        type: "error"
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleBack = () => {
    states.expense.setState((prev) => ({
      ...prev,
      details: null,
      payerList: [],
      memberSplitList: [],
      paymentSplitList: []
    }));
    router.back();
  };

  const isPayer = useMemo(
    () => payerList.some((payer) => payer.payer.id === userDetails?.id),
    [payerList, userDetails]
  );

  const isCreator = expenseDetails?.creator.id === userDetails?.id;

  // Editing replaces the splits wholesale, which is only safe while every
  // settlement is still pending. Mirror the server-side guard in the UI.
  const hasSettlementProgress = useMemo(
    () => paymentSplitList.some((p) => p.status !== "pending"),
    [paymentSplitList]
  );

  // Editing now works offline (the editor seeds from the cached snapshot and
  // queues an UPDATE_EXPENSE), so this is no longer gated on connectivity.
  const canEdit = Boolean(
    isCreator && !hasSettlementProgress && paymentSplitList.length
  );

  const isDraft = Boolean(expenseDetails?.is_draft);

  const handleEdit = () => {
    router.push(`/groups/${groupId}/${expenseId}/edit`);
  };

  // Finalizing reuses the edit screen, which detects the draft and writes its
  // splits + payments.
  const handleFinalize = () => {
    router.push(`/groups/${groupId}/${expenseId}/edit`);
  };

  // When both edit and delete are available, collapse them into a single
  // overflow menu (mirrors the group details screen). With only one action,
  // surface its icon button directly.
  const renderActions = (): ReactNode => {
    // A draft has no payers, so deletion is gated on creator instead.
    const showEdit = canEdit;
    const showDelete = isDraft ? isCreator : isPayer;

    if (!showEdit && !showDelete) return undefined;

    if (showEdit && showDelete) {
      return (
        <Stack.Toolbar.Menu
          icon="ellipsis"
          tintColor={getSecondaryHex("text-secondary-950", colorScheme)}
          accessibilityLabel="Expense options"
        >
          <Stack.Toolbar.MenuAction icon="pencil" onPress={handleEdit}>
            Edit
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
    }

    // Return an array (not a Fragment): the native toolbar flattens children
    // via React.Children.toArray, which does not descend into a <Fragment>.
    return [
      showEdit ? (
        <Stack.Toolbar.Button
          key="edit"
          icon="pencil"
          tintColor={getSecondaryHex("text-secondary-950", colorScheme)}
          accessibilityLabel="Edit expense"
          onPress={handleEdit}
        />
      ) : null,
      showDelete ? (
        <Stack.Toolbar.Button
          key="delete"
          icon="trash"
          tintColor={getSecondaryHex("text-secondary-950", colorScheme)}
          accessibilityLabel="Delete expense"
          onPress={() => setDeleteModalOpen(true)}
        />
      ) : null
    ];
  };

  const sortedMemberSplits = useMemo(
    () =>
      [...memberSplitList].sort((a, b) => {
        if (a.member.id === userDetails?.id) return -1;
        if (b.member.id === userDetails?.id) return 1;
        return 0;
      }),
    [memberSplitList, userDetails?.id]
  );

  const sortedPayerList = useMemo(
    () =>
      [...payerList].sort((a, b) => {
        if (a.payer.id === userDetails?.id) return -1;
        if (b.payer.id === userDetails?.id) return 1;
        return 0;
      }),
    [payerList, userDetails?.id]
  );

  return (
    <Fragment>
      <InnerLayout
        title="Expense Details"
        onBack={handleBack}
        actions={renderActions()}
      >
        <LoadingWrapper
          isLoading={loading}
          skeleton={<ExpenseDetailsSkeleton />}
        >
          {!expenseDetails ? (
            <VStack className="flex-1 py-16">
              <EmptyList
                type={EmptyType.EXPENSE}
                content={
                  isOnline
                    ? "This expense couldn't be loaded. Pull back and try again."
                    : "This expense isn't available offline yet. It'll appear once you're back online and it syncs."
                }
              />
            </VStack>
          ) : (
            <ScrollView className="flex-1">
              {expenseDetails && (
              <VStack className="gap-y-6 py-4">
                <VStack className="w-full gap-y-1 px-4">
                  <HStack className="items-center gap-x-2">
                    <Text
                      className="text-sm text-secondary-950 uppercase flex-1"
                      bold
                      numberOfLines={1}
                    >
                      {expenseDetails.description}
                    </Text>
                    {isDraft && (
                      <Badge
                        size="sm"
                        variant="solid"
                        className="rounded-full bg-warning-50 px-3"
                      >
                        <BadgeText className="font-bold text-xs uppercase text-warning-600">
                          Draft
                        </BadgeText>
                      </Badge>
                    )}
                  </HStack>
                  <Text className="text-3xl" bold>
                    {formatAmount(
                      expenseDetails.amount,
                      expenseDetails.currency
                    )}
                  </Text>
                </VStack>

                <VStack className="gap-y-2">
                  <Box className="bg-secondary-100 mx-4 rounded-xl overflow-hidden">
                    <DetailRow
                      label="Expense Date"
                      value={
                        <Text>{formatDate(expenseDetails.created_at)}</Text>
                      }
                    />
                    <Box className="mx-4">
                      <Divider className="border-secondary-200" />
                    </Box>
                    <DetailRow
                      label="Created By"
                      value={
                        <HStack className="gap-x-2 items-center">
                          <AppAvatar
                            name={`${expenseDetails.creator.first_name} ${expenseDetails.creator.last_name}`}
                            uri={expenseDetails.creator.avatar!}
                            size="sm"
                          />
                          <Text>
                            {expenseDetails.creator.first_name}{" "}
                            {expenseDetails.creator.last_name}
                            {expenseDetails.creator.id === userDetails?.id &&
                              " (You)"}
                          </Text>
                        </HStack>
                      }
                    />
                    {!isDraft && (
                      <>
                        <Box className="mx-4">
                          <Divider className="border-secondary-200" />
                        </Box>
                        <DetailRow
                          label="Split Type"
                          value={
                            <Text className="capitalize">
                              {expenseDetails.split_type}
                            </Text>
                          }
                        />
                      </>
                    )}
                    <Box className="mx-4">
                      <Divider className="border-secondary-200" />
                    </Box>
                    <DetailRow
                      label="Proof of Payment"
                      value={
                        expenseDetails.proof_of_payment ? (
                          <FormButton
                            size="md"
                            variant="outline"
                            text="View Image"
                            icon={
                              <FileImage
                                size={18}
                                color={getPrimaryHex(
                                  "text-primary-500",
                                  colorScheme
                                )}
                              />
                            }
                            onPress={() => setImageViewerOpen(true)}
                          />
                        ) : (
                          <Text className="text-sm text-secondary-950">
                            N/A
                          </Text>
                        )
                      }
                    />
                  </Box>
                </VStack>

                {isDraft ? (
                  <VStack className="gap-y-4 px-4">
                    <VStack className="bg-warning-50 rounded-xl p-4 gap-y-1">
                      <Text bold className="text-warning-700">
                        This expense is a draft
                      </Text>
                      <Text className="text-sm text-warning-700">
                        Only you can see it. Finalize it to set who paid and
                        split it among members — that's when it counts toward
                        balances and everyone gets notified.
                      </Text>
                    </VStack>
                    {isCreator && (
                      <FormButton
                        text="Finalize Expense"
                        disabled={!isOnline}
                        onPress={handleFinalize}
                      />
                    )}
                    {isCreator && !isOnline && (
                      <Text className="text-sm text-secondary-950 text-center">
                        Finalizing requires an internet connection.
                      </Text>
                    )}
                  </VStack>
                ) : (
                  <>
                    <VStack className="gap-y-2">
                      <Text className="text-xl px-4" bold>
                        Payers
                      </Text>
                      <FlatList
                        className="flex-1"
                        scrollEnabled={false}
                        data={sortedPayerList}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={({ item }) => <PayerItem payer={item} />}
                        ItemSeparatorComponent={ListDivider}
                        ListEmptyComponent={() => (
                          <EmptyList type={EmptyType.MEMBER} />
                        )}
                      />
                    </VStack>

                    <VStack className="gap-y-2">
                      <Text className="text-xl px-4" bold>
                        Member Splits
                      </Text>
                      <FlatList
                        className="flex-1"
                        scrollEnabled={false}
                        data={sortedMemberSplits}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={({ item }) => (
                          <MemberSplitItem memberSplit={item} />
                        )}
                        ItemSeparatorComponent={ListDivider}
                        ListEmptyComponent={() => (
                          <EmptyList type={EmptyType.MEMBER} />
                        )}
                      />
                    </VStack>
                  </>
                )}
                </VStack>
              )}
            </ScrollView>
          )}
        </LoadingWrapper>
      </InnerLayout>

      <ImageViewerSheet
        isOpen={imageViewerOpen}
        onClose={() => setImageViewerOpen(false)}
        uri={expenseDetails?.proof_of_payment ?? null}
        title="Proof of Payment"
      />

      <Modal
        isOpen={deleteModalOpen}
        onClose={() => !deleting && setDeleteModalOpen(false)}
      >
        <ModalContent>
          <ModalHeader>
            <Heading size="lg">Delete Expense</Heading>
          </ModalHeader>
          <ModalBody>
            <Text className="text-sm text-secondary-950">
              Deleting this expense will remove splits and payments associated
              with it. Are you sure you want to proceed?
            </Text>
          </ModalBody>
          <ModalFooter>
            <HStack className="gap-x-2">
              <FormButton
                variant="outline"
                text="Cancel"
                disabled={deleting}
                onPress={() => setDeleteModalOpen(false)}
              />
              <FormButton
                text="Yes"
                action="negative"
                loading={deleting}
                onPress={() => handleDeleteExpense(expenseId)}
              />
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Fragment>
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

function MemberSplitItem({ memberSplit }: { memberSplit: MemberSplit }) {
  const { details: userDetails } = states.user();
  const router = useRouter();
  const isMe = memberSplit.member.id === userDetails?.id;

  const handlePress = () => {
    router.push({
      pathname: "/friends/[friendId]",
      params: {
        friendId: memberSplit.member.id,
        name: `${memberSplit.member.first_name} ${memberSplit.member.last_name}`,
        email: memberSplit.member.email,
        avatar: memberSplit.member.avatar || ""
      }
    });
  };
  return (
    <Box className="p-4">
      <HStack className="gap-x-2 items-center">
        <AppAvatar
          name={memberSplit.member.first_name}
          uri={memberSplit.member.avatar!}
          size="md"
          isPlaceholder={memberSplit.member.is_placeholder}
        />
        <VStack className="flex-1">
          <Text className="text-lg">
            {memberSplit.member.first_name} {memberSplit.member.last_name}
            {isMe && " (You)"}
          </Text>
          <Text className="text-sm text-secondary-950">
            {getUserSubtitle(memberSplit.member)}
          </Text>
        </VStack>
        <VStack className="items-end gap-y-1">
          <Text className="text-lg">
            {formatAmount(memberSplit.amount, memberSplit.currency)}
          </Text>
        </VStack>
      </HStack>
    </Box>
  );
}

function PayerItem({ payer }: { payer: ExpensePayer }) {
  const { details: userDetails } = states.user();
  const isMe = payer.payer.id === userDetails?.id;

  return (
    <Box className="p-4">
      <HStack className="items-center gap-x-2">
        <HStack className="gap-x-2 items-center flex-1">
          <AppAvatar
            name={payer.payer.first_name}
            uri={payer.payer.avatar!}
            size="md"
            isPlaceholder={payer.payer.is_placeholder}
          />
          <VStack>
            <Text className="text-lg">
              {payer.payer.first_name} {payer.payer.last_name}
              {isMe && " (You)"}
            </Text>
            <Text className="text-sm text-secondary-950">
              {getUserSubtitle(payer.payer)}
            </Text>
          </VStack>
        </HStack>
        <Text className="text-lg">
          {formatAmount(payer.amount, payer.currency)}
        </Text>
      </HStack>
    </Box>
  );
}
