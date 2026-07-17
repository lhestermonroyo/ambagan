import AmountInput from "@/components/AmountInput";
import AppAvatar from "@/components/AppAvatar";
import AppAvatarGroup from "@/components/AppAvatarGroup";
import CurrencySelection from "@/components/CurrencySelection";
import FormButton from "@/components/FormButton";
import FormTextarea from "@/components/FormTextarea";
import Icon from "@/components/Icon";
import PressableListItem from "@/components/PressableListItem";
import {
  GroupCardSkeleton,
  PayerFieldSkeleton
} from "@/components/SkeletonLoader";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Box } from "@/components/ui/box";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText
} from "@/components/ui/form-control";
import { HStack } from "@/components/ui/hstack";
import { KeyboardAvoidingView } from "@/components/ui/keyboard-avoiding-view";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import UpgradeSheet from "@/components/UpgradeSheet";
import UploadImage from "@/components/UploadImage";
import { GroupSelectionActionSheet } from "@/features/expense/components/GroupSelection";
import { PayerSelectionActionSheet } from "@/features/expense/components/PayerSelection";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import {
  generatePaymentSplits,
  getAmountPerPerson,
  getPercentagePerPerson
} from "@/features/expense/utils/split.util";
import useAppToast from "@/hooks/use-app-toast";
import services from "@/services";
import states from "@/states";
import { Group, Member } from "@/types/groups";
import { cacheService } from "@/utils/cacheService";
import { currencies, DAILY_EXPENSE_LIMIT } from "@/utils/constants";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import * as offlineQueue from "@/utils/offlineQueue";
import { getUserSubtitle } from "@/utils/userDisplay";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView
} from "@gorhom/bottom-sheet";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import { ImagePickerSuccessResult } from "expo-image-picker";
import { useRouter } from "expo-router";
import { CalendarDays } from "lucide-react-native";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { Platform, useColorScheme } from "react-native";
import "react-native-get-random-values";
import { v4 as uuid } from "uuid";

type QuickAddExpenseSheetProps = {
  isOpen: boolean;
  group: Group | null;
  /** True while the caller is still fetching the group list, so the sheet shows
   * loading fields instead of the "no group" empty state on a cold open. */
  groupsLoading?: boolean;
  allowGroupChange?: boolean;
  /** Opened from a Scan Receipt (Beta) hand-off: seed the fields (and proof
   * image) from the scanDraft instead of starting blank. */
  seedFromScan?: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function QuickAddExpenseSheet({
  isOpen,
  group,
  groupsLoading = false,
  allowGroupChange = false,
  seedFromScan = false,
  onClose,
  onSuccess
}: QuickAddExpenseSheetProps) {
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(group);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("PHP");
  const [expenseDate, setExpenseDate] = useState(new Date());
  const [proofOfPayment, setProofOfPayment] =
    useState<ImagePickerSuccessResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [selectedPayer, setSelectedPayer] = useState<Member | null>(null);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [payerPickerOpen, setPayerPickerOpen] = useState(false);
  const [upgradeSheetOpen, setUpgradeSheetOpen] = useState(false);
  const [upgradeDescription, setUpgradeDescription] = useState<
    string | undefined
  >(undefined);
  const [dailyCount, setDailyCount] = useState(0);

  const { details: currentUser, defaultCurrency } = states.user();
  const isPro = currentUser?.plan === "pro";
  const toast = useAppToast();
  const router = useRouter();
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";
  const dateSheetRef = useRef<BottomSheetModal>(null);
  // True for the lifetime of a scan-seeded open, so the group-change effect
  // below doesn't reset the scanned currency back to the default.
  const scanSeededRef = useRef(false);

  const openDateSheet = useCallback(() => dateSheetRef.current?.present(), []);
  const closeDateSheet = useCallback(() => dateSheetRef.current?.dismiss(), []);

  useEffect(() => {
    if (isOpen) {
      // Seed from the Scan Receipt (Beta) hand-off when opened for a scan;
      // otherwise start blank. Scanned currency is only honored for Pro (free =
      // PHP-only) and only when it's a currency we support — mirrors the Custom
      // flow (see [[project_multicurrency]]).
      const draft = seedFromScan ? states.expense.getState().scanDraft : null;
      scanSeededRef.current = !!draft;

      const scannedCurrency =
        isPro &&
        draft?.currency &&
        currencies.some((c) => c.value === draft.currency)
          ? draft.currency
          : null;
      const scannedDate = draft?.date ? new Date(draft.date) : null;

      setAmount(draft?.amount ?? "");
      setDescription(draft?.description ?? "");
      setExpenseDate(
        scannedDate && !isNaN(scannedDate.getTime()) ? scannedDate : new Date()
      );
      setProofOfPayment(draft?.proof_of_payment ?? null);
      setSelectedGroup(group);
      setSelectedPayer(null);
      setCurrency(scannedCurrency ?? (isPro ? defaultCurrency : "PHP"));
      if (group) fetchMembers(group.id);
      if (!isPro && currentUser?.id) {
        services.expense
          .getDailyExpenseCount(currentUser.id)
          .then(setDailyCount)
          .catch(() => {});
      }

      // The draft has been consumed — clear it so a later blank open starts fresh.
      if (draft) states.expense.getState().clearScanDraft();
    } else {
      setMembers([]);
      setSelectedPayer(null);
      setProofOfPayment(null);
      scanSeededRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedGroup && isOpen) {
      // Don't clobber a scanned currency when the seeded group settles in.
      if (!scanSeededRef.current) {
        setCurrency(isPro ? defaultCurrency : "PHP");
      }
      fetchMembers(selectedGroup.id);
    }
  }, [selectedGroup?.id]);

  // On a cold open the default group may still be loading; adopt it once the
  // caller resolves it so the fields fill in without reopening the sheet.
  useEffect(() => {
    if (isOpen && group && !selectedGroup) {
      setSelectedGroup(group);
    }
  }, [group?.id, isOpen]);

  const applyMembers = (result: Member[]) => {
    setMembers(result);
    const self = result.find((m) => m.id === currentUser?.id);
    setSelectedPayer(self ?? result[0] ?? null);
  };

  const fetchMembers = async (groupId: string) => {
    setMembersLoading(true);
    try {
      const result = await services.member.getMembersByGroupId(groupId);
      if (result) applyMembers(result);
    } catch {
      // Offline (or fetch failed) — fall back to the cached member list so the
      // payer and split cards still render and the expense can be queued.
      try {
        const cached = await cacheService.getGroupDetail(groupId);
        if (cached?.memberList?.length) {
          applyMembers(cached.memberList as Member[]);
        }
      } catch {
        // submit stays disabled if there's no cached member list either
      }
    } finally {
      setMembersLoading(false);
    }
  };

  const memberAvatars = useMemo(
    () =>
      members.map((m) => ({
        id: m.id,
        name: m.first_name,
        uri: m.avatar || undefined
      })),
    [members]
  );

  const parsedAmount = parseFloat(amount) || 0;
  const memberCount = members.length;
  const perPerson = memberCount > 0 ? parsedAmount / memberCount : 0;

  const canSubmit =
    parsedAmount > 0 &&
    description.trim().length > 0 &&
    !submitting &&
    memberCount >= 2 &&
    !!currentUser &&
    !!selectedGroup &&
    !!selectedPayer;

  // A default group exists (even if not yet adopted into selectedGroup).
  const hasGroup = !!group || !!selectedGroup;
  // Genuinely no group to add to — not just still loading the group list.
  const showEmptyState = !hasGroup && !groupsLoading;
  // The group + payer fields depend on the member fetch, so skeleton them until
  // the members (and default payer) are ready.
  const fieldsLoading =
    membersLoading ||
    (!!group && !selectedGroup) ||
    (!hasGroup && groupsLoading);

  const handleSubmit = async () => {
    if (!currentUser || !selectedGroup || !canSubmit) return;

    // Offline → queue the expense optimistically and skip the daily-limit
    // check (it can't be enforced without the server).
    const online = await offlineQueue.isOnline();
    if (!online) {
      const amounts = getAmountPerPerson(parsedAmount, memberCount);
      const percentages = getPercentagePerPerson(memberCount);
      const memberSplits = members.map((m, i) => ({
        userId: m.id,
        amount: amounts[i],
        percentage: percentages[i]
      }));
      const payersArr = [
        { userId: selectedPayer?.id ?? currentUser.id, amount: parsedAmount }
      ];
      const paymentSplits = generatePaymentSplits(payersArr, memberSplits);

      const clientId = uuid();
      const optimisticPayments = offlineQueue.buildOptimisticPayments({
        expenseId: clientId,
        groupId: selectedGroup.id,
        description: description.trim(),
        currency,
        members,
        currentUser,
        paymentSplits
      });
      const optimistic = offlineQueue.buildOptimisticExpense({
        clientId,
        groupId: selectedGroup.id,
        amount: parsedAmount,
        description: description.trim(),
        currency,
        creator: {
          id: currentUser.id,
          email: currentUser.email,
          phone: currentUser.phone,
          first_name: currentUser.first_name,
          last_name: currentUser.last_name,
          avatar: currentUser.avatar,
          plan: currentUser.plan
        },
        payers: payersArr,
        members
      });

      await offlineQueue.queueAddExpense(
        selectedGroup.id,
        {
          expensePayload: {
            amount: parsedAmount,
            description: description.trim(),
            // Offline queues store a URL, not a pending upload — so a scanned
            // receipt image can't be attached until we're back online.
            proof_of_payment: null,
            group_id: selectedGroup.id,
            split_type: "equal",
            currency,
            expense_date: expenseDate.toISOString()
          },
          payers: payersArr,
          memberSplits,
          paymentSplits
        },
        optimistic,
        optimisticPayments,
        members
      );

      toast({
        title: "Saved offline",
        description:
          "This expense will sync automatically when you're back online.",
        type: "info"
      });
      onClose();
      return;
    }

    if (!isPro) {
      const count = await services.expense.getDailyExpenseCount(currentUser.id);
      if (count >= DAILY_EXPENSE_LIMIT) {
        setUpgradeDescription(
          "You've reached your 5 expense limit for today. Upgrade to Pro for unlimited expenses."
        );
        setUpgradeSheetOpen(true);
        return;
      }
    }

    setSubmitting(true);

    try {
      const amounts = getAmountPerPerson(parsedAmount, memberCount);
      const percentages = getPercentagePerPerson(memberCount);

      const memberSplits = members.map((m, i) => ({
        userId: m.id,
        amount: amounts[i],
        percentage: percentages[i]
      }));

      const payers = [
        { userId: selectedPayer?.id ?? currentUser.id, amount: parsedAmount }
      ];
      const paymentSplits = generatePaymentSplits(payers, memberSplits);

      await services.expense.saveExpense(
        {
          amount: parsedAmount,
          description: description.trim(),
          group_id: selectedGroup.id,
          proof_of_payment: proofOfPayment,
          split_type: "equal",
          currency,
          expense_date: expenseDate
        },
        payers,
        memberSplits,
        paymentSplits
      );

      toast({
        title: "Expense Added",
        description: "Split equally among all members.",
        type: "success"
      });
      onSuccess();
      onClose();
    } catch {
      toast({
        title: "Failed",
        description: "Could not add expense. Please try again.",
        type: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[90]}>
        <ActionsheetBackdrop />
        <ActionsheetContent className="p-0">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1, width: "100%" }}
          >
            <VStack className="w-full flex-1">
              <HStack className="align-items justify-between">
                <Pressable onPress={onClose}>
                  <HStack className="p-4 items-start">
                    <Icon as="arrow-back-ios" className="text-secondary-950" />
                    <VStack>
                      <Text bold className="text-xl">
                        Quick Add
                      </Text>
                      <Text className="text-sm text-secondary-950">
                        Paid by you · Equal split · Dated today
                      </Text>
                    </VStack>
                  </HStack>
                </Pressable>
                {!isPro && (
                  <VStack className="px-4 pt-4">
                    <DailyLimitText
                      count={dailyCount}
                      limit={DAILY_EXPENSE_LIMIT}
                    />
                  </VStack>
                )}
              </HStack>

              {showEmptyState ? (
                <VStack className="flex-1 p-4">
                  <VStack className="items-center justify-center flex-1 gap-y-4">
                    <Icon
                      as="sentiment-dissatisfied"
                      size={64}
                      className="text-primary-400"
                    />
                    <Text className="text-center">
                      You are not part of any group yet. Please join or create a
                      group to be able to add an expense.
                    </Text>
                    <FormButton
                      text="Create Group"
                      iconEnd={
                        <Icon
                          as="chevron-right"
                          className="text-background-0"
                        />
                      }
                      onPress={() => router.push("/groups/create")}
                    />
                  </VStack>
                </VStack>
              ) : (
                <>
                  <ScrollView className="flex-1 px-4">
                    <VStack className="gap-y-6">
                      <FormControl size="md">
                        <FormControlLabel>
                          <FormControlLabelText>Amount</FormControlLabelText>
                        </FormControlLabel>
                        <HStack className="gap-x-2 items-end h-12">
                          <CurrencySelection
                            currency={currency}
                            onCurrencyChange={setCurrency}
                            locked={!isPro}
                            onLockedPress={() => {
                              setUpgradeDescription(
                                "Multi-currency expenses are a Pro feature. Upgrade to split bills in any currency."
                              );
                              setUpgradeSheetOpen(true);
                            }}
                          />
                          <VStack className="flex-1">
                            <AmountInput
                              className="h-full"
                              placeholder="0.00"
                              value={amount}
                              onChangeText={setAmount}
                            />
                          </VStack>
                        </HStack>
                      </FormControl>

                      <FormTextarea
                        label="Description"
                        placeholder="Enter description (e.g., Dinner at KFC Baguio)"
                        value={description}
                        onChangeText={setDescription}
                        autoCapitalize="none"
                        size="sm"
                      />

                      <FormControl size="md">
                        <FormControlLabel>
                          <FormControlLabelText>
                            Expense Date
                          </FormControlLabelText>
                        </FormControlLabel>
                        <PressableListItem
                          onPress={openDateSheet}
                          className="p-4 border border-background-200 rounded-lg"
                        >
                          <HStack className="items-center gap-x-2">
                            <CalendarDays
                              color={getSecondaryHex(
                                "text-secondary-950",
                                colorScheme
                              )}
                            />
                            <Text className="flex-1 text-lg">
                              {format(expenseDate, "MMMM dd, yyyy")}
                            </Text>
                            <Icon
                              as="unfold-more"
                              className="text-sm text-secondary-950"
                            />
                          </HStack>
                        </PressableListItem>
                      </FormControl>

                      {fieldsLoading ? (
                        <FormControl size="md">
                          <FormControlLabel>
                            <FormControlLabelText>Payer</FormControlLabelText>
                          </FormControlLabel>
                          <PayerFieldSkeleton />
                        </FormControl>
                      ) : (
                        selectedPayer && (
                          <FormControl size="md">
                            <FormControlLabel>
                              <FormControlLabelText>Payer</FormControlLabelText>
                            </FormControlLabel>
                            <PressableListItem
                              className="p-4 border border-background-200 rounded-lg"
                              onPress={() => setPayerPickerOpen(true)}
                            >
                              <HStack className="justify-between items-center gap-x-2 flex-1">
                                <HStack className="gap-x-3 items-center flex-1">
                                  <AppAvatar
                                    name={`${selectedPayer.first_name} ${selectedPayer.last_name ?? ""}`.trim()}
                                    uri={selectedPayer.avatar ?? ""}
                                  />
                                  <VStack className="flex-1">
                                    <HStack className="gap-x-1 items-center">
                                      <Text className="text-lg">
                                        {selectedPayer.first_name}{" "}
                                        {selectedPayer.last_name}{" "}
                                        {selectedPayer.id === currentUser?.id &&
                                          "(You)"}
                                      </Text>
                                    </HStack>
                                    <Text className="text-sm text-secondary-950">
                                      {getUserSubtitle(selectedPayer)}
                                    </Text>
                                  </VStack>
                                </HStack>
                                <Icon
                                  as="unfold-more"
                                  className="text-sm text-secondary-950"
                                />
                              </HStack>
                            </PressableListItem>
                          </FormControl>
                        )
                      )}

                      {fieldsLoading ? (
                        <GroupCardSkeleton />
                      ) : memberCount > 0 ? (
                        <Fragment>
                          {allowGroupChange ? (
                            <PressableListItem
                              className="p-4 border border-background-200 rounded-lg"
                              onPress={() => setGroupPickerOpen(true)}
                            >
                              <HStack className="justify-between items-center gap-x-2">
                                <HStack className="gap-x-2 items-center flex-1">
                                  <VStack className="gap-y-2 flex-1">
                                    <Text
                                      bold
                                      className="text-sm text-secondary-950 uppercase"
                                      numberOfLines={1}
                                    >
                                      {selectedGroup?.name}
                                    </Text>
                                    <VStack className="items-start gap-y-1">
                                      <AppAvatarGroup
                                        items={memberAvatars}
                                        size="sm"
                                        maxDisplay={4}
                                      />
                                      <Text className="text-secondary-950 text-sm">
                                        {memberCount} member
                                        {memberCount !== 1 ? "s" : ""}
                                      </Text>
                                    </VStack>
                                  </VStack>
                                  <VStack className="items-end">
                                    <Text
                                      bold
                                      className="text-2xl text-primary-400"
                                    >
                                      {formatAmount(perPerson, currency)}
                                    </Text>
                                    <Text className="text-secondary-950 text-sm">
                                      each
                                    </Text>
                                  </VStack>
                                </HStack>
                                <Icon
                                  as="unfold-more"
                                  className="text-sm text-secondary-950"
                                />
                              </HStack>
                            </PressableListItem>
                          ) : (
                            <Box className="p-4 border border-background-200 rounded-lg">
                              <HStack className="justify-between items-center gap-x-2 flex-1">
                                <HStack className="gap-x-2 items-center flex-1">
                                  <VStack className="gap-y-2 flex-1">
                                    <Text
                                      bold
                                      className="text-sm text-secondary-950 uppercase"
                                      numberOfLines={1}
                                    >
                                      {selectedGroup?.name}
                                    </Text>
                                    <VStack className="items-start gap-y-1">
                                      <AppAvatarGroup
                                        items={memberAvatars}
                                        size="sm"
                                        maxDisplay={4}
                                      />
                                      <Text className="text-secondary-950 text-sm">
                                        {memberCount} member
                                        {memberCount !== 1 ? "s" : ""}
                                      </Text>
                                    </VStack>
                                  </VStack>
                                  <VStack className="items-end">
                                    <Text
                                      bold
                                      className="text-2xl text-primary-400"
                                    >
                                      {formatAmount(perPerson, currency)}
                                    </Text>
                                    <Text className="text-secondary-950 text-sm">
                                      each
                                    </Text>
                                  </VStack>
                                </HStack>
                              </HStack>
                            </Box>
                          )}
                        </Fragment>
                      ) : null}

                      <VStack className="gap-y-1">
                        <UploadImage
                          title="Upload Proof of Payment"
                          key={proofOfPayment?.assets?.[0]?.uri ?? "none"}
                          defaultUri={proofOfPayment?.assets?.[0]?.uri ?? null}
                          onSelect={setProofOfPayment}
                        />
                        <Text className="text-secondary-950 text-sm">
                          Proof could be a photo of receipt, screenshot of
                          online payment, or any document that shows the expense
                          details.
                        </Text>
                      </VStack>
                    </VStack>
                  </ScrollView>

                  <Box className="items-center justify-center p-4">
                    <HStack className="gap-x-2">
                      <FormButton
                        className="flex-1"
                        text="Add Expense"
                        loading={submitting}
                        disabled={!canSubmit}
                        onPress={handleSubmit}
                      />
                    </HStack>
                  </Box>
                </>
              )}
            </VStack>
          </KeyboardAvoidingView>
        </ActionsheetContent>
      </Actionsheet>

      {selectedGroup && (
        <GroupSelectionActionSheet
          isOpen={groupPickerOpen}
          onClose={() => setGroupPickerOpen(false)}
          currentGroup={selectedGroup}
          onChangeGroup={(g) => setSelectedGroup(g)}
        />
      )}
      <PayerSelectionActionSheet
        isOpen={payerPickerOpen}
        members={members}
        currentPayer={selectedPayer}
        onClose={() => setPayerPickerOpen(false)}
        onSave={(payer) => setSelectedPayer(payer)}
      />

      <UpgradeSheet
        isOpen={upgradeSheetOpen}
        onClose={() => setUpgradeSheetOpen(false)}
        onProceed={onClose}
        description={upgradeDescription}
      />

      <BottomSheetModal
        ref={dateSheetRef}
        snapPoints={["60%"]}
        backgroundStyle={{
          backgroundColor: getSecondaryHex("text-secondary-0", colorScheme)
        }}
        handleIndicatorStyle={{
          backgroundColor: getSecondaryHex("text-secondary-500", colorScheme)
        }}
        backdropComponent={(props) => (
          <BottomSheetBackdrop
            {...props}
            appearsOnIndex={0}
            disappearsOnIndex={-1}
          />
        )}
      >
        <BottomSheetView>
          <VStack className="gap-y-2 items-center">
            <VStack className="self-start px-4">
              <Text
                bold
                className="text-xl"
                style={{
                  color: colorScheme === "dark" ? "#F5F5F5" : "#141414"
                }}
              >
                Select Expense Date
              </Text>
            </VStack>
            <VStack className="pb-4">
              <DateTimePicker
                value={expenseDate}
                mode="date"
                display="inline"
                themeVariant={colorScheme}
                accentColor={getPrimaryHex("text-primary-400", colorScheme)}
                onChange={(_, date) => {
                  if (date) {
                    setExpenseDate(date);
                    closeDateSheet();
                  }
                }}
              />
            </VStack>
          </VStack>
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );
}

function DailyLimitText({ count, limit }: { count: number; limit: number }) {
  const remaining = limit - count;
  const isLimitReached = remaining <= 0;

  return (
    <Badge
      size="md"
      variant="solid"
      className={`rounded-full px-3 py-2 ${isLimitReached ? "bg-error-50" : "bg-primary-50"}`}
    >
      <BadgeText
        className={`font-bold text-xs uppercase ${isLimitReached ? "text-error-600" : "text-primary-400"}`}
      >
        {isLimitReached ? "LIMIT REACHED" : `${remaining} / ${limit} LEFT`}
      </BadgeText>
    </Badge>
  );
}
