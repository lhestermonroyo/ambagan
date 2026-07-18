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
import { Badge, BadgeText } from "@/components/ui/badge";
import { Box } from "@/components/ui/box";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText
} from "@/components/ui/form-control";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import UpgradeSheet from "@/components/UpgradeSheet";
import UploadImage from "@/components/UploadImage";
import { GroupSelectionActionSheet } from "@/features/expense/components/GroupSelection";
import PayerContributionSheet from "@/features/expense/components/PayerContributionSheet";
import SplitExpenseSheet from "@/features/expense/components/SplitExpenseSheet";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import {
  generatePaymentSplits,
  getAmountPerPerson,
  getPercentagePerPerson
} from "@/features/expense/utils/split.util";
import { defaultExpenseGroup } from "@/features/group/utils/groupMembers";
import useAppToast from "@/hooks/use-app-toast";
import FormLayout from "@/layouts/FormLayout";
import services from "@/services";
import states from "@/states";
import { Group, Member } from "@/types/groups";
import { cacheService } from "@/utils/cacheService";
import { currencies, DAILY_EXPENSE_LIMIT, splitTypes } from "@/utils/constants";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import * as offlineQueue from "@/utils/offlineQueue";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView
} from "@gorhom/bottom-sheet";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import { ImagePickerSuccessResult } from "expo-image-picker";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter
} from "expo-router";
import { CalendarDays } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useColorScheme } from "react-native";
import "react-native-get-random-values";
import { v4 as uuid } from "uuid";

/**
 * Add Expense: log an expense in one screen. Defaults to the quick path — paid
 * by you, split evenly, dated today — but the Paid-by and Split rows each open a
 * fullscreen sheet to customize payers (multiple contributors) and the split
 * (equal / percentage / exact amounts, with member exclusion). Opened from Home
 * (group defaults to the one you most recently joined, changeable) or from a
 * group (that group, locked), and seeds from a Scan Receipt (Beta) hand-off when
 * a scanDraft is waiting. This is the single expense form — it replaced the
 * separate Quick/Custom flows.
 */
export default function AddExpenseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const groupId = params.groupId as string | undefined;
  // Reached with the literal "[groupId]" segment from Home (group changeable)
  // or with a real id from a group screen (group locked).
  const isLocked = !!groupId && groupId !== "[groupId]";

  const { list: groupList, initialized: groupsInitialized } = states.group();
  const { details: currentUser, session, defaultCurrency } = states.user();
  const userId = currentUser?.id ?? session?.user?.id;
  const isPro = currentUser?.plan === "pro";

  const toast = useAppToast();
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";
  const dateSheetRef = useRef<BottomSheetModal>(null);

  // Seed from a Scan Receipt (Beta) hand-off if one is waiting. Read once at
  // mount via a lazy initializer; the draft is cleared in the effect below so a
  // back-out + re-entry starts clean. Scanned currency is only honored for Pro
  // (free = PHP-only) and only when it's a currency we support — see
  // [[project_multicurrency]].
  const [seed] = useState(() => {
    const draft = states.expense.getState().scanDraft;
    const scannedCurrency =
      isPro &&
      draft?.currency &&
      currencies.some((c) => c.value === draft.currency)
        ? draft.currency
        : null;
    const scannedDate = draft?.date ? new Date(draft.date) : null;
    return {
      amount: draft?.amount ?? "",
      description: draft?.description ?? "",
      currency: scannedCurrency ?? (isPro ? defaultCurrency : "PHP"),
      expenseDate:
        scannedDate && !isNaN(scannedDate.getTime()) ? scannedDate : new Date(),
      proofOfPayment: (draft?.proof_of_payment ??
        null) as ImagePickerSuccessResult | null
    };
  });

  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [amount, setAmount] = useState(seed.amount);
  const [description, setDescription] = useState(seed.description);
  const [currency, setCurrency] = useState(seed.currency);
  const [expenseDate, setExpenseDate] = useState(seed.expenseDate);
  const [proofOfPayment, setProofOfPayment] =
    useState<ImagePickerSuccessResult | null>(seed.proofOfPayment);
  const [submitting, setSubmitting] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  // Who paid, as userId → contributed amount. Empty means the default "you paid
  // the whole thing"; the payer sheet populates it when the user splits the
  // payment. Reset whenever the group (and its member list) changes.
  const [payers, setPayers] = useState<Record<string, { amount: string }>>({});
  // How the total is divided. Empty splits + "equal" means the default "split
  // evenly across everyone"; the split sheet populates these when customized.
  // Reset alongside payers when the group (member list) changes.
  const [splits, setSplits] = useState<
    Record<string, { amount: string; percentage: string }>
  >({});
  const [splitType, setSplitType] =
    useState<(typeof splitTypes)[number]["value"]>("equal");
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [payerSheetOpen, setPayerSheetOpen] = useState(false);
  const [splitSheetOpen, setSplitSheetOpen] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [upgradeSheetOpen, setUpgradeSheetOpen] = useState(false);
  const [upgradeDescription, setUpgradeDescription] = useState<
    string | undefined
  >(undefined);
  const [dailyCount, setDailyCount] = useState(0);

  const openDateSheet = useCallback(() => dateSheetRef.current?.present(), []);
  const closeDateSheet = useCallback(() => dateSheetRef.current?.dismiss(), []);

  // The scan hand-off has been consumed by the seed initializer above — clear it
  // so leaving and re-entering this screen doesn't re-seed a stale receipt.
  useEffect(() => {
    const { scanDraft, clearScanDraft } = states.expense.getState();
    if (scanDraft) clearScanDraft();
  }, []);

  useEffect(() => {
    if (!isPro && userId) {
      services.expense
        .getDailyExpenseCount(userId)
        .then(setDailyCount)
        .catch(() => {});
    }
  }, [isPro, userId]);

  // Resolve the group once the list is available. On a cold launch the list may
  // still be loading; adopt the default when it settles without clobbering a
  // group the user picked via the changer.
  useFocusEffect(
    useCallback(() => {
      if (!groupList.length) return;
      setSelectedGroup((prev) => {
        if (prev) return prev;
        if (isLocked) return groupList.find((g) => g.id === groupId) ?? null;
        return defaultExpenseGroup(groupList, userId) ?? groupList[0];
      });
    }, [groupList, isLocked, groupId, userId])
  );

  const applyMembers = (result: Member[]) => {
    setMembers(result);
    // Reset payers + split to their defaults — a changed group has a different
    // member list, so any prior customization no longer applies.
    setPayers({});
    setSplits({});
    setSplitType("equal");
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

  useEffect(() => {
    // fetchMembers flips its own loading flag; the deps intentionally track only
    // the group id so a re-fetch fires when the selected group changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selectedGroup) fetchMembers(selectedGroup.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroup?.id]);

  const parsedAmount = parseFloat(amount) || 0;
  const memberCount = members.length;

  // Everyone the user actually entered a contribution for. Empty → the default
  // "you paid it all" (which we materialize only at submit time so it always
  // tracks the current total).
  const activePayers = useMemo(
    () =>
      Object.entries(payers)
        .map(([userId, v]) => ({ userId, amount: parseFloat(v.amount) || 0 }))
        .filter((p) => p.amount > 0),
    [payers]
  );
  const isMultiPayer = activePayers.length >= 2;
  const payersSum = activePayers.reduce((s, p) => s + p.amount, 0);
  // A single/default payer is always valid (we force their amount to the total);
  // only a genuine multi-payer split has to add up.
  const payersValid =
    !isMultiPayer || Math.abs(payersSum - parsedAmount) < 0.01;

  // The members shown on the Paid-by row (self first). Falls back to "you" when
  // nothing's been entered yet.
  const payerMembers = useMemo(() => {
    const ids = activePayers.map((p) => p.userId);
    const self = members.find((m) => m.id === currentUser?.id) ?? null;
    const list = ids.length
      ? members.filter((m) => ids.includes(m.id))
      : self
        ? [self]
        : [];
    return [...list].sort((a, b) =>
      a.id === currentUser?.id ? -1 : b.id === currentUser?.id ? 1 : 0
    );
  }, [activePayers, members, currentUser?.id]);

  const selfFullName = currentUser
    ? `${currentUser.first_name} ${currentUser.last_name ?? ""}`.trim()
    : "You";
  const leadPayerName = (m?: Member | null) => {
    if (!m) return `${selfFullName} (You)`;
    const full = `${m.first_name} ${m.last_name ?? ""}`.trim();
    return m.id === currentUser?.id ? `${full} (You)` : full;
  };
  const othersCount = payerMembers.length - 1;
  const payerLabel = isMultiPayer
    ? `${leadPayerName(payerMembers[0])} and ${othersCount} other${
        othersCount > 1 ? "s" : ""
      }`
    : leadPayerName(payerMembers[0]);

  const handleOpenPayerSheet = () => {
    if (parsedAmount <= 0) {
      toast({
        title: "Enter an amount first",
        description: "Add the expense amount before choosing payers.",
        type: "info"
      });
      return;
    }
    setPayerSheetOpen(true);
  };

  // Switching group swaps the member list, so any who-paid split no longer maps.
  // Clear members + payers synchronously (not just in the async member fetch) so
  // there's no window where the new group is submitted with the old split, and
  // flag the change so the user isn't surprised when a custom split is dropped.
  const handleChangeGroup = (next: Group) => {
    if (next.id === selectedGroup?.id) return;
    const hadCustomization =
      isMultiPayer || splitType !== "equal" || includedIds.length < memberCount;
    if (hadCustomization) {
      toast({
        title: "Payers and split were reset",
        description: "The new group has different members.",
        type: "info"
      });
    }
    setMembers([]);
    setPayers({});
    setSplits({});
    setSplitType("equal");
    setSelectedGroup(next);
  };

  const buildPayers = () =>
    isMultiPayer
      ? activePayers
      : [
          {
            userId: activePayers[0]?.userId ?? currentUser!.id,
            amount: parsedAmount
          }
        ];

  // --- Split (who owes what) ---
  // Members included in the split. Empty committed splits → everyone (the
  // default equal split); once customized, only members with a value.
  // Plain derivations (the React Compiler memoizes these) — cheap, and they
  // avoid manual-memoization conflicts from the chained dependencies below.
  const activeSplitMembers = members.filter((m) => {
    const s = splits[m.id];
    return (
      s &&
      ((parseFloat(s.amount) || 0) > 0 || (parseFloat(s.percentage) || 0) > 0)
    );
  });
  const includedIds = activeSplitMembers.length
    ? activeSplitMembers.map((m) => m.id)
    : members.map((m) => m.id);

  // Resolve each included member's share reactively from the current total, so
  // equal and percentage splits stay in sync as the amount changes; exact
  // (custom) amounts are used verbatim and go stale if the total later changes.
  const effectiveSplits: Record<
    string,
    { amount: number; percentage: number }
  > = {};
  if (splitType === "equal") {
    const amts = getAmountPerPerson(parsedAmount, includedIds.length);
    const pcts = getPercentagePerPerson(includedIds.length);
    includedIds.forEach((id, i) => {
      effectiveSplits[id] = { amount: amts[i] || 0, percentage: pcts[i] || 0 };
    });
  } else if (splitType === "percentage") {
    includedIds.forEach((id) => {
      const pct = parseFloat(splits[id]?.percentage || "0") || 0;
      effectiveSplits[id] = {
        amount: (parsedAmount * pct) / 100,
        percentage: pct
      };
    });
  } else {
    includedIds.forEach((id) => {
      const amt = parseFloat(splits[id]?.amount || "0") || 0;
      effectiveSplits[id] = {
        amount: amt,
        percentage: parsedAmount > 0 ? (amt / parsedAmount) * 100 : 0
      };
    });
  }

  const splitTotal = includedIds.reduce(
    (s, id) => s + (parseFloat(splits[id]?.amount || "0") || 0),
    0
  );
  const percentTotal = includedIds.reduce(
    (s, id) => s + (parseFloat(splits[id]?.percentage || "0") || 0),
    0
  );
  const splitValid =
    includedIds.length >= 1 &&
    (splitType === "equal" ||
      (splitType === "percentage" && Math.abs(percentTotal - 100) < 0.01) ||
      (splitType === "custom" && Math.abs(splitTotal - parsedAmount) < 0.01));

  const buildMemberSplits = () =>
    includedIds
      .map((id) => ({
        userId: id,
        amount: effectiveSplits[id]?.amount ?? 0,
        percentage: effectiveSplits[id]?.percentage ?? 0
      }))
      .filter((s) => s.amount > 0 && s.percentage > 0);

  // The effective payer ids: the explicit multi-payer set, or the single/default
  // payer (falls back to the current user when nothing's been entered yet).
  const payerIds = (
    isMultiPayer
      ? activePayers.map((p) => p.userId)
      : [activePayers[0]?.userId ?? currentUser?.id]
  ).filter((id): id is string => !!id);

  // An expense needs at least two distinct people across payers ∪ split members
  // (mirrors the Custom flow) — otherwise it's a no-op or a solo charge.
  const involvedIds = new Set<string>(payerIds);
  includedIds.forEach((id) => {
    if ((effectiveSplits[id]?.amount ?? 0) > 0) involvedIds.add(id);
  });
  const distinctInvolved = involvedIds.size;

  const perIncluded =
    includedIds.length > 0 ? parsedAmount / includedIds.length : 0;

  // --- Consolidated group + split card summary ---
  // Short label for the split-type mini-summary (right side of the card).
  const splitTypeLabel =
    splitType === "equal"
      ? "Split Equally"
      : splitType === "percentage"
        ? "By Percentage"
        : "Customize Split";
  // "Split among X of Y" once anyone's excluded; otherwise the plain headcount.
  const splitAmongText =
    includedIds.length < memberCount
      ? `Split among ${includedIds.length} of ${memberCount}`
      : `${memberCount} member${memberCount !== 1 ? "s" : ""}`;
  // Avatars of the members actually included in the split (not the whole group).
  const splitAvatars = includedIds.map((id) => {
    const m = members.find((mm) => mm.id === id);
    return { id, name: m?.first_name ?? "", uri: m?.avatar || undefined };
  });
  // Per-person breakdown shown when "Show breakdown" is toggled: name + % + amount.
  const breakdownRows = includedIds.map((id) => {
    const m = members.find((mm) => mm.id === id);
    const s = effectiveSplits[id];
    const full = m ? `${m.first_name} ${m.last_name ?? ""}`.trim() : "";
    return {
      id,
      name: id === currentUser?.id ? `${full} (You)` : full,
      amount: s?.amount ?? 0,
      percentage: s?.percentage ?? 0
    };
  });
  const splitError =
    splitType === "percentage"
      ? "Percentages must total 100%."
      : splitType === "custom"
        ? `Amounts must add up to ${formatAmount(parsedAmount, currency)}.`
        : "Select at least one member to split with.";

  const handleOpenSplitSheet = () => {
    if (parsedAmount <= 0) {
      toast({
        title: "Enter an amount first",
        description: "Add the expense amount before customizing the split.",
        type: "info"
      });
      return;
    }
    setSplitSheetOpen(true);
  };

  const canSubmit =
    parsedAmount > 0 &&
    description.trim().length > 0 &&
    !submitting &&
    !membersLoading &&
    memberCount >= 2 &&
    !!currentUser &&
    !!selectedGroup &&
    payersValid &&
    splitValid &&
    distinctInvolved >= 2;

  const handleSubmit = async () => {
    if (!currentUser || !selectedGroup || !canSubmit) return;

    // Offline → queue the expense optimistically and skip the daily-limit
    // check (it can't be enforced without the server).
    const online = await offlineQueue.isOnline();
    if (!online) {
      const memberSplits = buildMemberSplits();
      const payersArr = buildPayers();
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
            split_type: splitType,
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
      router.back();
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
      const memberSplits = buildMemberSplits();
      const payersArr = buildPayers();
      const paymentSplits = generatePaymentSplits(payersArr, memberSplits);

      await services.expense.saveExpense(
        {
          amount: parsedAmount,
          description: description.trim(),
          group_id: selectedGroup.id,
          proof_of_payment: proofOfPayment,
          split_type: splitType,
          currency,
          expense_date: expenseDate
        },
        payersArr,
        memberSplits,
        paymentSplits
      );

      toast({
        title: "Expense Added",
        description: "Your expense has been added.",
        type: "success"
      });
      // Origin screens (Home / group) re-init on focus, so backing out refreshes
      // the list without an explicit callback.
      router.back();
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

  // No group to add to — not just still loading the list.
  if (!selectedGroup) {
    const hasNoGroups = groupsInitialized && groupList.length === 0;

    return (
      <FormLayout title="Add Expense" onBack={() => router.back()} footer={[]}>
        {hasNoGroups ? (
          <VStack className="flex-1 p-4">
            <VStack className="items-center justify-center flex-1 gap-y-4">
              <Icon
                as="sentiment-dissatisfied"
                size={64}
                className="text-primary-400"
              />
              <Text className="text-center">
                You are not part of any group yet. Please join or create a group
                to be able to add an expense.
              </Text>
              <FormButton
                text="Create Group"
                iconEnd={
                  <Icon as="chevron-right" className="text-background-0" />
                }
                onPress={() => router.push("/groups/create")}
              />
            </VStack>
          </VStack>
        ) : (
          <VStack className="flex-1 p-4 gap-y-6">
            <GroupCardSkeleton />
            <PayerFieldSkeleton />
          </VStack>
        )}
      </FormLayout>
    );
  }

  const fieldsLoading = membersLoading;

  return (
    <>
      <FormLayout
        title="Add Expense"
        actions={
          !isPro ? (
            <Stack.Toolbar.View>
              <DailyLimitBadge count={dailyCount} limit={DAILY_EXPENSE_LIMIT} />
            </Stack.Toolbar.View>
          ) : undefined
        }
        onBack={() => router.back()}
        footer={[
          <FormButton
            key="add-expense-submit"
            className="flex-1"
            text="Add Expense"
            loading={submitting}
            disabled={!canSubmit}
            onPress={handleSubmit}
          />
        ]}
      >
        <ScrollView className="flex-1 px-4">
          <VStack className="gap-y-6 pt-2">
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
                <FormControlLabelText>Expense Date</FormControlLabelText>
              </FormControlLabel>
              <PressableListItem
                onPress={openDateSheet}
                className="p-4 border border-background-200 rounded-lg"
              >
                <HStack className="items-center gap-x-2">
                  <CalendarDays
                    color={getSecondaryHex("text-secondary-950", colorScheme)}
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
                  <FormControlLabelText>Paid by</FormControlLabelText>
                </FormControlLabel>
                <PayerFieldSkeleton />
              </FormControl>
            ) : (
              <FormControl size="md">
                <FormControlLabel>
                  <FormControlLabelText>Paid by</FormControlLabelText>
                </FormControlLabel>
                <PressableListItem
                  className="p-4 border border-background-200 rounded-lg"
                  onPress={handleOpenPayerSheet}
                >
                  <HStack className="justify-between items-center gap-x-2">
                    <HStack className="gap-x-3 items-center flex-1">
                      {isMultiPayer ? (
                        <AppAvatarGroup
                          items={payerMembers.map((m) => ({
                            id: m.id,
                            name: m.first_name,
                            uri: m.avatar || undefined
                          }))}
                          size="sm"
                          maxDisplay={3}
                        />
                      ) : (
                        <AppAvatar
                          name={
                            payerMembers[0]?.first_name ??
                            currentUser?.first_name ??
                            "You"
                          }
                          uri={
                            payerMembers[0]?.avatar ?? currentUser?.avatar ?? ""
                          }
                        />
                      )}
                      <Text className="text-lg flex-1" numberOfLines={1}>
                        {payerLabel}
                      </Text>
                    </HStack>
                    <Icon
                      as="unfold-more"
                      className="text-sm text-secondary-950"
                    />
                  </HStack>
                </PressableListItem>
                {!payersValid && (
                  <Text className="text-sm text-error-500 mt-1">
                    Contributions must add up to{" "}
                    {formatAmount(parsedAmount, currency)}.
                  </Text>
                )}
              </FormControl>
            )}

            {fieldsLoading ? (
              <GroupCardSkeleton />
            ) : memberCount > 0 ? (
              <FormControl size="md">
                <VStack
                  className={`border rounded-lg overflow-hidden ${
                    !splitValid ? "border-error-300" : "border-background-200"
                  }`}
                >
                  {/* Top: group name + group changer (chevrons). Only the top
                      row is pressable — the card below holds its own buttons. */}
                  {!isLocked ? (
                    <Pressable
                      className="px-4 pt-4"
                      onPress={() => setGroupPickerOpen(true)}
                    >
                      {({ pressed }) => (
                        <HStack
                          className={cn(
                            "items-center gap-x-2",
                            pressed && "opacity-50"
                          )}
                        >
                          <Text
                            bold
                            className="text-sm text-secondary-950 uppercase"
                            numberOfLines={1}
                          >
                            {selectedGroup?.name}
                          </Text>
                          <Icon
                            as="unfold-more"
                            size={18}
                            className="text-sm text-secondary-950"
                          />
                        </HStack>
                      )}
                    </Pressable>
                  ) : (
                    <Box className="px-4 pt-4">
                      <Text
                        bold
                        className="text-sm text-secondary-950 uppercase"
                        numberOfLines={1}
                      >
                        {selectedGroup?.name}
                      </Text>
                    </Box>
                  )}

                  {/* Middle: included avatars + "split among" on the left,
                      split-type summary on the right. */}
                  <HStack className="px-4 pt-4 justify-between items-start gap-x-3">
                    <VStack className="items-start gap-y-1 flex-1">
                      <AppAvatarGroup
                        items={splitAvatars}
                        size="sm"
                        maxDisplay={4}
                      />
                      <Text className="text-secondary-950 text-sm">
                        {splitAmongText}
                      </Text>
                    </VStack>
                    <VStack className="items-end justify-center gap-y-1">
                      {splitType === "equal" && (
                        <HStack className="gap-x-2">
                          <Text
                            bold
                            className="text-2xl text-primary-500"
                            numberOfLines={1}
                          >
                            {formatAmount(perIncluded, currency)}
                          </Text>
                          <Text className="text-secondary-950 text-sm self-end mb-1">
                            each
                          </Text>
                        </HStack>
                      )}
                      <HStack className="items-center gap-x-1">
                        <Icon
                          as="call-split"
                          size={18}
                          className="text-sm text-secondary-950"
                        />
                        <Text className="text-secondary-950 text-sm">
                          {splitTypeLabel}
                        </Text>
                      </HStack>
                    </VStack>
                  </HStack>

                  {!splitValid && (
                    <Text className="text-sm text-error-500 px-4 pt-2">
                      {splitError}
                    </Text>
                  )}

                  {/* Actions: edit the split, or reveal the per-person breakdown. */}
                  <HStack className="gap-x-2 p-4">
                    <FormButton
                      className="flex-1"
                      size="sm"
                      action={!splitValid ? "negative" : "primary"}
                      text="Edit Split"
                      onPress={handleOpenSplitSheet}
                    />
                    <FormButton
                      className="flex-1"
                      size="sm"
                      variant="outline"
                      text={showBreakdown ? "Hide breakdown" : "Show breakdown"}
                      onPress={() => setShowBreakdown((prev) => !prev)}
                    />
                  </HStack>

                  {/* Toggled per-person breakdown: name + % + amount. */}
                  {showBreakdown && (
                    <VStack className="border-t border-background-200 gap-y-2 py-2">
                      {breakdownRows.map((row) => (
                        <HStack
                          key={row.id}
                          className="justify-between items-center gap-x-2 px-4 py-2"
                        >
                          <Text className="flex-1" numberOfLines={1}>
                            {row.name}
                          </Text>
                          <Text className="text-secondary-950 text-sm w-14 text-right">
                            {row.percentage.toFixed(1)}%
                          </Text>
                          <Text bold className="text-right">
                            {formatAmount(row.amount, currency)}
                          </Text>
                        </HStack>
                      ))}
                    </VStack>
                  )}
                </VStack>
              </FormControl>
            ) : null}

            <VStack className="gap-y-1 pb-4">
              <UploadImage
                title="Upload Proof of Payment"
                key={proofOfPayment?.assets?.[0]?.uri ?? "none"}
                defaultUri={proofOfPayment?.assets?.[0]?.uri ?? null}
                onSelect={setProofOfPayment}
              />
              <Text className="text-secondary-950 text-sm">
                Proof could be a photo of receipt, screenshot of online payment,
                or any document that shows the expense details.
              </Text>
            </VStack>
          </VStack>
        </ScrollView>
      </FormLayout>

      {selectedGroup && !isLocked && (
        <GroupSelectionActionSheet
          isOpen={groupPickerOpen}
          onClose={() => setGroupPickerOpen(false)}
          currentGroup={selectedGroup}
          onChangeGroup={handleChangeGroup}
        />
      )}
      <PayerContributionSheet
        isOpen={payerSheetOpen}
        members={members}
        amount={amount}
        currency={currency}
        payers={payers}
        isLockedGroup={isLocked}
        groupName={selectedGroup?.name}
        onClose={() => setPayerSheetOpen(false)}
        onDone={(next) => {
          setPayers(next);
          setPayerSheetOpen(false);
        }}
      />
      <SplitExpenseSheet
        isOpen={splitSheetOpen}
        members={members}
        amount={amount}
        currency={currency}
        groupId={selectedGroup?.id ?? ""}
        splits={splits}
        splitType={splitType}
        payerIds={payerIds}
        isLockedGroup={isLocked}
        groupName={selectedGroup?.name}
        onClose={() => setSplitSheetOpen(false)}
        onDone={(nextSplits, nextType) => {
          setSplits(nextSplits);
          setSplitType(nextType);
          setSplitSheetOpen(false);
        }}
      />

      <UpgradeSheet
        isOpen={upgradeSheetOpen}
        onClose={() => setUpgradeSheetOpen(false)}
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

function DailyLimitBadge({ count, limit }: { count: number; limit: number }) {
  const remaining = limit - count;
  const isLimitReached = remaining <= 0;

  return (
    <Badge
      size="md"
      variant="solid"
      className={`rounded-full px-4 py-2 ${isLimitReached ? "bg-error-50" : "bg-primary-50"}`}
    >
      <BadgeText
        className={`font-bold text-sm uppercase ${isLimitReached ? "text-error-600" : "text-primary-400"}`}
      >
        {isLimitReached ? "LIMIT REACHED" : `${remaining} / ${limit} LEFT`}
      </BadgeText>
    </Badge>
  );
}
