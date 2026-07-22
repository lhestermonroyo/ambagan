import AmountInput from "@/components/AmountInput";
import AppAvatar from "@/components/AppAvatar";
import AppAvatarGroup from "@/components/AppAvatarGroup";
import CurrencySelection from "@/components/CurrencySelection";
import FormButton from "@/components/FormButton";
import FormTextarea from "@/components/FormTextarea";
import Icon from "@/components/Icon";
import LoadingWrapper from "@/components/LoadingWrapper";
import PressableListItem from "@/components/PressableListItem";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText
} from "@/components/ui/form-control";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import UpgradeSheet from "@/components/UpgradeSheet";
import UploadImage from "@/components/UploadImage";
import PayerContributionSheet from "@/features/expense/components/PayerContributionSheet";
import SplitExpenseSheet from "@/features/expense/components/SplitExpenseSheet";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import {
  generatePaymentSplits,
  getAmountPerPerson,
  getPercentagePerPerson
} from "@/features/expense/utils/split.util";
import useAppToast from "@/hooks/use-app-toast";
import FormLayout from "@/layouts/FormLayout";
import services from "@/services";
import states from "@/states";
import { Group, Member } from "@/types/groups";
import { User } from "@/types/user";
import { cacheService } from "@/utils/cacheService";
import { splitTypes } from "@/utils/constants";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import * as offlineQueue from "@/utils/offlineQueue";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import { ImagePickerSuccessResult } from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { CalendarDays, Edit3, ListPlus } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { useColorScheme } from "react-native";

type SplitTypeValue = (typeof splitTypes)[number]["value"];

/**
 * Edit Expense: the same single-screen form as Add Expense (amount, description,
 * date, a Paid-by row + Split card that each open a fullscreen sheet), but seeded
 * from an existing expense and locked to its group. Doubles as the Finalize
 * screen for a draft — same form, the primary action writes splits + notifies the
 * group instead of just saving changes. Blocks when a settlement is already in
 * progress, or when offline without a cached snapshot to edit from.
 */
export default function EditExpenseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const groupId = params.groupId as string;
  const expenseId = params.expenseId as string;

  const { details: currentUser } = states.user();
  const userId = currentUser?.id;
  const isPro = currentUser?.plan === "pro";

  const toast = useAppToast();
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [blockReason, setBlockReason] = useState<
    "offline" | "settled" | "notfound" | null
  >(null);
  // A draft is finalized through this same screen — same form, different submit.
  const [isDraft, setIsDraft] = useState(false);

  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("PHP");
  const [expenseDate, setExpenseDate] = useState(new Date());
  const [proofOfPayment, setProofOfPayment] =
    useState<ImagePickerSuccessResult | null>(null);
  const [existingProofUrl, setExistingProofUrl] = useState<string | null>(null);

  const [members, setMembers] = useState<Member[]>([]);
  // Who paid, as userId → contributed amount. Seeded from the expense's payer
  // rows (a draft defaults to the creator paying the full amount).
  const [payers, setPayers] = useState<Record<string, { amount: string }>>({});
  // How the total is divided, seeded from the expense's member splits. Empty for
  // a draft → the split sheet auto-distributes equally like a fresh expense.
  const [splits, setSplits] = useState<
    Record<string, { amount: string; percentage: string }>
  >({});
  const [splitType, setSplitType] = useState<SplitTypeValue>("equal");

  const [payerSheetOpen, setPayerSheetOpen] = useState(false);
  const [splitSheetOpen, setSplitSheetOpen] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [upgradeSheetOpen, setUpgradeSheetOpen] = useState(false);
  const [upgradeDescription, setUpgradeDescription] = useState<
    string | undefined
  >(undefined);

  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const openDateSheet = useCallback(() => setDateSheetOpen(true), []);
  const closeDateSheet = useCallback(() => setDateSheetOpen(false), []);

  const init = useCallback(async () => {
    setLoading(true);

    const online = await offlineQueue.isOnline();

    try {
      let expense: any;
      let payerList: any[];
      let memberSplitList: any[];
      let paymentList: any[];
      let rawMembers: any[];
      let group: any;

      if (online) {
        [expense, payerList, memberSplitList, paymentList, rawMembers, group] =
          await Promise.all([
            services.expense.getExpenseById(expenseId),
            services.expense.getPayersByExpenseId(expenseId),
            services.expense.getMemberSplitsByExpenseId(expenseId),
            services.expense.getPaymentsByExpenseId(expenseId),
            services.member.getMembersByGroupId(groupId),
            services.group.getGroupById(groupId)
          ]);
      } else {
        // Offline: hydrate from the per-expense snapshot + group caches warmed
        // when the expense / group were last viewed online.
        const cached = await cacheService.getExpenseDetail(expenseId);
        const groupDetail = await cacheService.getGroupDetail(groupId);
        const gState = states.group.getState();
        group =
          gState.details?.id === groupId
            ? gState.details
            : (gState.list.find((g) => g.id === groupId) ?? null);

        if (!cached || !group) {
          // Never viewed online → no snapshot to edit from.
          setBlockReason("offline");
          setLoading(false);
          return;
        }

        expense = cached.expense;
        payerList = cached.payerList;
        memberSplitList = cached.memberSplits;
        paymentList = cached.paymentSplits;
        rawMembers = groupDetail?.memberList ?? [];

        // Finalizing a draft writes splits + sends notifications — online only.
        if (expense?.is_draft) {
          setBlockReason("offline");
          setLoading(false);
          return;
        }
      }

      if (!expense || !group) {
        setBlockReason("notfound");
        setLoading(false);
        return;
      }

      // Warm the per-expense snapshot so this expense stays editable offline.
      if (online) {
        cacheService
          .saveExpenseDetail(
            expenseId,
            expense,
            payerList,
            memberSplitList,
            paymentList
          )
          .catch(() => {});
      }

      // Block editing once any settlement has moved past "pending" — replacing
      // the splits would silently drop that progress.
      const hasProgress = paymentList.some((p) => p.status !== "pending");
      if (hasProgress) {
        setBlockReason("settled");
        setLoading(false);
        return;
      }

      const sortedMembers = [...rawMembers].sort((a, b) =>
        a.id === userId ? -1 : b.id === userId ? 1 : 0
      );

      // Seed only the members who actually paid / share the expense — the new
      // form treats an unlisted member as excluded (an empty payer map means
      // "you paid it all"; an empty split map means "split equally among all").
      const seededPayers: Record<string, { amount: string }> = {};
      payerList.forEach((payer) => {
        seededPayers[payer.payer.id] = { amount: String(payer.amount) };
      });
      const seededSplits: Record<
        string,
        { amount: string; percentage: string }
      > = {};
      memberSplitList.forEach((split) => {
        seededSplits[split.member.id] = {
          amount: String(split.amount),
          percentage: String(split.percentage)
        };
      });

      // A draft has no payer rows yet — default the creator as the sole payer of
      // the full amount so the Paid-by row starts valid (the user can adjust).
      if (expense.is_draft && userId) {
        seededPayers[userId] = { amount: String(expense.amount) };
      }

      setIsDraft(Boolean(expense.is_draft));
      setSelectedGroup(group as unknown as Group);
      setMembers(sortedMembers);
      setPayers(seededPayers);
      setSplits(seededSplits);
      setSplitType(
        (expense.split_type as SplitTypeValue) ?? splitTypes[0].value
      );
      setExistingProofUrl(expense.proof_of_payment ?? null);
      setProofOfPayment(null);
      setCurrency(expense.currency || "PHP");
      setAmount(String(expense.amount));
      setDescription(expense.description ?? "");
      setExpenseDate(new Date(expense.expense_date ?? expense.created_at));
      setBlockReason(null);
    } catch (error) {
      console.log("Error loading expense for edit:", error);
      setBlockReason("notfound");
    } finally {
      setLoading(false);
    }
  }, [expenseId, groupId, userId]);

  useFocusEffect(
    useCallback(() => {
      if (!groupId || !expenseId) {
        router.back();
        return;
      }
      init();
    }, [groupId, expenseId, init, router])
  );

  const parsedAmount = parseFloat(amount) || 0;
  const memberCount = members.length;

  // --- Paid by (who paid, how much) ---
  const activePayers = useMemo(
    () =>
      Object.entries(payers)
        .map(([id, v]) => ({ userId: id, amount: parseFloat(v.amount) || 0 }))
        .filter((p) => p.amount > 0),
    [payers]
  );
  const isMultiPayer = activePayers.length >= 2;
  const payersSum = activePayers.reduce((s, p) => s + p.amount, 0);
  // A single/default payer is always valid (we force their amount to the total);
  // only a genuine multi-payer split has to add up.
  const payersValid =
    !isMultiPayer || Math.abs(payersSum - parsedAmount) < 0.01;

  const payerMembers = useMemo(() => {
    const ids = activePayers.map((p) => p.userId);
    const self = members.find((m) => m.id === userId) ?? null;
    const list = ids.length
      ? members.filter((m) => ids.includes(m.id))
      : self
        ? [self]
        : [];
    return [...list].sort((a, b) =>
      a.id === userId ? -1 : b.id === userId ? 1 : 0
    );
  }, [activePayers, members, userId]);

  const selfFullName = currentUser
    ? `${currentUser.first_name} ${currentUser.last_name ?? ""}`.trim()
    : "You";
  const leadPayerName = (m?: Member | null) => {
    if (!m) return `${selfFullName} (You)`;
    const full = `${m.first_name} ${m.last_name ?? ""}`.trim();
    return m.id === userId ? `${full} (You)` : full;
  };
  const leadPayerFirstName = (m?: Member | null) => {
    if (!m) return `${currentUser?.first_name ?? "You"} (You)`;
    return m.id === userId ? `${m.first_name} (You)` : m.first_name;
  };
  const othersCount = payerMembers.length - 1;
  const payerLabel = isMultiPayer
    ? `${leadPayerFirstName(payerMembers[0])} and ${othersCount} other${
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

  const payerIds = (
    isMultiPayer
      ? activePayers.map((p) => p.userId)
      : [activePayers[0]?.userId ?? userId]
  ).filter((id): id is string => !!id);

  // An expense needs at least two distinct people across payers ∪ split members.
  const involvedIds = new Set<string>(payerIds);
  includedIds.forEach((id) => {
    if ((effectiveSplits[id]?.amount ?? 0) > 0) involvedIds.add(id);
  });
  const distinctInvolved = involvedIds.size;

  const perIncluded =
    includedIds.length > 0 ? parsedAmount / includedIds.length : 0;

  // --- Consolidated group + split card summary ---
  const splitTypeLabel =
    splitType === "equal"
      ? "Split Equally"
      : splitType === "percentage"
        ? "By Percentage"
        : "Customize Split";
  const splitAmongText =
    includedIds.length < memberCount
      ? `Split among ${includedIds.length} of ${memberCount}`
      : `${memberCount} member${memberCount !== 1 ? "s" : ""}`;
  const splitAvatars = includedIds.map((id) => {
    const m = members.find((mm) => mm.id === id);
    return { id, name: m?.first_name ?? "", uri: m?.avatar || undefined };
  });
  const breakdownRows = includedIds.map((id) => {
    const m = members.find((mm) => mm.id === id);
    const s = effectiveSplits[id];
    const full = m ? `${m.first_name} ${m.last_name ?? ""}`.trim() : "";
    return {
      id,
      name: id === userId ? `${full} (You)` : full,
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
    memberCount >= 2 &&
    !!currentUser &&
    !!selectedGroup &&
    payersValid &&
    splitValid &&
    distinctInvolved >= 2;

  const handleSubmit = async () => {
    if (!currentUser || !selectedGroup || !canSubmit) return;

    const memberSplits = buildMemberSplits();
    const payersArr = buildPayers();
    const paymentSplits = generatePaymentSplits(payersArr, memberSplits);
    if (paymentSplits.length === 0) {
      toast({
        title: "Invalid Expense",
        description:
          "Everyone paid their exact share. There's nothing to split or settle.",
        type: "error"
      });
      return;
    }

    const online = await offlineQueue.isOnline();

    // Offline: finalizing a draft is online-only (it notifies members); a normal
    // edit is queued with an optimistic update + refreshed detail snapshot.
    if (!online) {
      if (isDraft) {
        toast({
          title: "You're offline",
          description: "Finalizing a draft requires an internet connection.",
          type: "error"
        });
        return;
      }

      const optimistic = offlineQueue.buildOptimisticExpense({
        clientId: expenseId,
        groupId: selectedGroup.id,
        amount: parsedAmount,
        description: description.trim(),
        currency,
        creator: currentUser as any,
        payers: payersArr,
        members
      });

      const detailMemberSplits = memberSplits.map((s) => ({
        // Stable id so the detail screen's keyExtractor (item.id.toString()) works.
        id: `${expenseId}-${s.userId}`,
        expense_id: expenseId,
        member: members.find((m) => m.id === s.userId),
        amount: s.amount,
        percentage: s.percentage
      }));
      const detailPayments = offlineQueue.buildOptimisticPayments({
        expenseId,
        groupId: selectedGroup.id,
        description: description.trim(),
        currency,
        members,
        currentUser: currentUser as any,
        paymentSplits
      });
      const detailExpense = {
        ...optimistic,
        split_type: splitType,
        expense_date: expenseDate.toISOString(),
        proof_of_payment: existingProofUrl
      };

      const args: offlineQueue.UpdateExpenseArgs = {
        expensePayload: {
          amount: parsedAmount,
          description: description.trim(),
          // Offline can't upload a newly picked image — keep the existing URL.
          proof_of_payment: existingProofUrl,
          group_id: selectedGroup.id,
          split_type: splitType,
          currency,
          expense_date: expenseDate.toISOString()
        },
        payers: payersArr,
        memberSplits,
        paymentSplits
      };

      await offlineQueue.queueUpdateExpense(
        selectedGroup.id,
        expenseId,
        args,
        optimistic,
        {
          expense: detailExpense,
          payerList: optimistic.payer_list,
          memberSplits: detailMemberSplits,
          paymentSplits: detailPayments
        }
      );

      toast({
        title: "Saved offline",
        description: "Your changes will sync automatically when you're online.",
        type: "info"
      });
      router.back();
      return;
    }

    setSubmitting(true);
    try {
      const expensePayload = {
        amount: parsedAmount,
        description: description.trim(),
        proof_of_payment: proofOfPayment ?? existingProofUrl,
        group_id: selectedGroup.id,
        split_type: splitType,
        currency,
        expense_date: expenseDate
      };

      const response = isDraft
        ? await services.expense.finalizeDraft(
            expenseId,
            expensePayload,
            payersArr,
            memberSplits,
            paymentSplits
          )
        : await services.expense.updateExpense(
            expenseId,
            expensePayload,
            payersArr,
            memberSplits,
            paymentSplits
          );

      if (!response) {
        throw new Error(
          isDraft ? "Failed to finalize draft" : "Failed to update expense"
        );
      }

      toast({
        title: isDraft ? "Draft Finalized" : "Expense Updated",
        description: isDraft
          ? "Your expense has been split and shared with the group."
          : "Your changes have been saved.",
        type: "success"
      });
      router.back();
    } catch (error: any) {
      console.log("Error saving expense:", error);
      if (error?.message === services.expense.SETTLEMENT_IN_PROGRESS) {
        toast({
          title: "Can't Edit Expense",
          description:
            "A settlement is already in progress for this expense, so it can no longer be edited.",
          type: "error"
        });
      } else {
        toast({
          title: isDraft ? "Finalize Failed" : "Update Failed",
          description: isDraft
            ? "An error occurred while finalizing the draft. Please try again."
            : "An error occurred while updating the expense. Please try again.",
          type: "error"
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (blockReason) {
    return (
      <FormLayout title="Edit Expense" onBack={() => router.back()} footer={[]}>
        <VStack className="flex-1 items-center justify-center gap-y-4 p-8">
          <Icon
            as={blockReason === "offline" ? "wifi-off" : "lock"}
            size={64}
            className="text-primary-400"
          />
          <Text className="text-center text-secondary-950">
            {blockReason === "offline"
              ? "Editing an expense requires an internet connection. Please reconnect and try again."
              : blockReason === "settled"
                ? "This expense can no longer be edited because a settlement is already in progress."
                : "We couldn't load this expense. Please go back and try again."}
          </Text>
          <FormButton text="Go Back" onPress={() => router.back()} />
        </VStack>
      </FormLayout>
    );
  }

  const proofUri = proofOfPayment?.assets?.[0]?.uri ?? existingProofUrl ?? null;

  return (
    <>
      <FormLayout
        title={isDraft ? "Finalize Expense" : "Edit Expense"}
        onBack={() => router.back()}
        footer={
          loading
            ? []
            : [
                <FormButton
                  key="edit-expense-submit"
                  className="flex-1"
                  text={isDraft ? "Finalize" : "Save Changes"}
                  loading={submitting}
                  disabled={!canSubmit}
                  onPress={handleSubmit}
                />
              ]
        }
      >
        <LoadingWrapper isLoading={loading} text="Loading expense...">
          {selectedGroup && (
            <ScrollableContent
              amount={amount}
              setAmount={setAmount}
              description={description}
              setDescription={setDescription}
              currency={currency}
              setCurrency={setCurrency}
              isPro={isPro}
              onCurrencyLockedPress={() => {
                setUpgradeDescription(
                  "Multi-currency expenses are a Pro feature. Upgrade to split bills in any currency."
                );
                setUpgradeSheetOpen(true);
              }}
              expenseDate={expenseDate}
              openDateSheet={openDateSheet}
              colorScheme={colorScheme}
              isMultiPayer={isMultiPayer}
              payerMembers={payerMembers}
              currentUser={currentUser}
              payerLabel={payerLabel}
              payersValid={payersValid}
              parsedAmount={parsedAmount}
              handleOpenPayerSheet={handleOpenPayerSheet}
              memberCount={memberCount}
              splitValid={splitValid}
              selectedGroup={selectedGroup}
              splitAvatars={splitAvatars}
              splitAmongText={splitAmongText}
              splitType={splitType}
              perIncluded={perIncluded}
              splitTypeLabel={splitTypeLabel}
              splitError={splitError}
              handleOpenSplitSheet={handleOpenSplitSheet}
              showBreakdown={showBreakdown}
              setShowBreakdown={setShowBreakdown}
              breakdownRows={breakdownRows}
              proofUri={proofUri}
              setProofOfPayment={setProofOfPayment}
            />
          )}
        </LoadingWrapper>
      </FormLayout>

      <PayerContributionSheet
        isOpen={payerSheetOpen}
        members={members}
        amount={amount}
        currency={currency}
        payers={payers}
        isLockedGroup
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
        isLockedGroup
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

      <Actionsheet isOpen={dateSheetOpen} onClose={closeDateSheet}>
        <ActionsheetBackdrop />
        <ActionsheetContent className="p-0">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <VStack className="w-full gap-y-2 items-center">
            <VStack className="self-start px-4 pt-4">
              <Text bold className="text-xl">
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
                onNeutralButtonPress={closeDateSheet}
                onChange={(_, date) => {
                  if (date) {
                    setExpenseDate(date);
                    closeDateSheet();
                  }
                }}
              />
            </VStack>
          </VStack>
        </ActionsheetContent>
      </Actionsheet>
    </>
  );
}

/**
 * The scrollable form body. Extracted so the block/loading branches above stay
 * readable — it's the same layout as Add Expense (amount, description, date, the
 * Paid-by row, the consolidated group + split card, and the proof upload).
 */
function ScrollableContent(props: {
  amount: string;
  setAmount: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  currency: string;
  setCurrency: (v: string) => void;
  isPro: boolean;
  onCurrencyLockedPress: () => void;
  expenseDate: Date;
  openDateSheet: () => void;
  colorScheme: "light" | "dark";
  isMultiPayer: boolean;
  payerMembers: Member[];
  currentUser: User | null;
  payerLabel: string;
  payersValid: boolean;
  parsedAmount: number;
  handleOpenPayerSheet: () => void;
  memberCount: number;
  splitValid: boolean;
  selectedGroup: Group;
  splitAvatars: { id: string; name: string; uri: string | undefined }[];
  splitAmongText: string;
  splitType: SplitTypeValue;
  perIncluded: number;
  splitTypeLabel: string;
  splitError: string;
  handleOpenSplitSheet: () => void;
  showBreakdown: boolean;
  setShowBreakdown: (fn: (prev: boolean) => boolean) => void;
  breakdownRows: {
    id: string;
    name: string;
    amount: number;
    percentage: number;
  }[];
  proofUri: string | null;
  setProofOfPayment: (v: ImagePickerSuccessResult | null) => void;
}) {
  const {
    amount,
    setAmount,
    description,
    setDescription,
    currency,
    setCurrency,
    isPro,
    onCurrencyLockedPress,
    expenseDate,
    openDateSheet,
    colorScheme,
    isMultiPayer,
    payerMembers,
    currentUser,
    payerLabel,
    payersValid,
    parsedAmount,
    handleOpenPayerSheet,
    memberCount,
    splitValid,
    selectedGroup,
    splitAvatars,
    splitAmongText,
    splitType,
    perIncluded,
    splitTypeLabel,
    splitError,
    handleOpenSplitSheet,
    showBreakdown,
    setShowBreakdown,
    breakdownRows,
    proofUri,
    setProofOfPayment
  } = props;

  return (
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
              onLockedPress={onCurrencyLockedPress}
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
              <Icon as="unfold-more" className="text-sm text-secondary-950" />
            </HStack>
          </PressableListItem>
        </FormControl>

        <FormControl size="md">
          <FormControlLabel>
            <FormControlLabelText>Payers</FormControlLabelText>
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
                    size="sm"
                    uri={payerMembers[0]?.avatar ?? currentUser?.avatar ?? ""}
                  />
                )}
                <Text className="text-lg flex-1" numberOfLines={1}>
                  {payerLabel}
                </Text>
              </HStack>
              <Icon as="unfold-more" className="text-sm text-secondary-950" />
            </HStack>
          </PressableListItem>
          {!payersValid && (
            <Text className="text-sm text-error-500 mt-1">
              Contributions must add up to{" "}
              {formatAmount(parsedAmount, currency)}.
            </Text>
          )}
        </FormControl>

        {memberCount > 0 ? (
          <FormControl size="md">
            <VStack
              className={`border rounded-lg overflow-hidden ${
                !splitValid ? "border-error-300" : "border-background-200"
              }`}
            >
              {/* Group name (locked — editing can't move an expense's group). */}
              <Box className="px-4 pt-4">
                <Text
                  bold
                  className="text-sm text-secondary-950 uppercase"
                  numberOfLines={1}
                >
                  {selectedGroup.name}
                </Text>
              </Box>

              {/* Included avatars + "split among" on the left, split-type summary
                  on the right. */}
              <HStack className="px-4 pt-4 justify-between items-start gap-x-3">
                <VStack className="items-start gap-y-1 flex-1">
                  <AppAvatarGroup
                    items={splitAvatars}
                    size="sm"
                    maxDisplay={4}
                  />
                  <HStack className="items-center gap-x-1">
                    <Text className="text-secondary-950 text-sm">
                      {splitAmongText} · {splitTypeLabel}
                    </Text>
                  </HStack>
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
                      <Text className="text-secondary-950 text-sm self-end mb-[2px]">
                        each
                      </Text>
                    </HStack>
                  )}
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
                  icon={
                    <Edit3
                      size={16}
                      color={getSecondaryHex("text-secondary-0", colorScheme)}
                    />
                  }
                  text="Edit Split"
                  onPress={handleOpenSplitSheet}
                />
                <FormButton
                  className="flex-1"
                  size="sm"
                  variant="outline"
                  icon={
                    <ListPlus
                      size={16}
                      color={getPrimaryHex("text-primary-500", colorScheme)}
                    />
                  }
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
            title="Upload Proof of Payment (optional)"
            key={proofUri ?? "none"}
            defaultUri={proofUri}
            onSelect={setProofOfPayment}
          />
          <Text className="text-secondary-950 text-sm">
            Proof could be a photo of receipt, screenshot of online payment, or
            any document that shows the expense details.
          </Text>
        </VStack>
      </VStack>
    </ScrollView>
  );
}
