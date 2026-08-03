import AmountInput from "@/components/AmountInput";
import AppAvatar from "@/components/AppAvatar";
import AppAvatarGroup from "@/components/AppAvatarGroup";
import CategoryIcon from "@/components/CategoryIcon";
import CurrencySelection from "@/components/CurrencySelection";
import DailyLimitBadge from "@/components/DailyLimitBadge";
import DatePickerModal from "@/components/DatePickerModal";
import FormButton from "@/components/FormButton";
import FormTextarea from "@/components/FormTextarea";
import Icon from "@/components/Icon";
import PressableListItem from "@/components/PressableListItem";
import SelectField from "@/components/SelectField";
import {
  GroupCardSkeleton,
  PayerFieldSkeleton
} from "@/components/SkeletonLoader";
import { Box } from "@/components/ui/box";
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlLabel,
  FormControlLabelText
} from "@/components/ui/form-control";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import UpgradeSheet from "@/components/UpgradeSheet";
import UploadImage from "@/components/UploadImage";
import CategorySheet, {
  expenseCategoryMeta
} from "@/features/expense/components/CategorySheet";
import ExpenseOptions, {
  ExpenseOptionChip
} from "@/features/expense/components/ExpenseOptions";
import { GroupSelectionActionSheet } from "@/features/expense/components/GroupSelection";
import PayerContributionSheet from "@/features/expense/components/PayerContributionSheet";
import RecurrenceSheet from "@/features/expense/components/RecurrenceSheet";
import SplitExpenseSheet from "@/features/expense/components/SplitExpenseSheet";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import { recurrenceSummary } from "@/features/expense/utils/recurrence.util";
import {
  generatePaymentSplits,
  getAmountPerPerson,
  getPercentagePerPerson
} from "@/features/expense/utils/split.util";
import { defaultExpenseGroup } from "@/features/group/utils/groupMembers";
import useAppToast from "@/hooks/use-app-toast";
import { useNetwork } from "@/hooks/useNetwork";
import FormLayout from "@/layouts/FormLayout";
import services from "@/services";
import states from "@/states";
import { ExpenseCategory, RecurrenceConfig } from "@/types/expenses";
import { Group, Member } from "@/types/groups";
import { cacheService } from "@/utils/cacheService";
import { currencies, DAILY_EXPENSE_LIMIT, splitTypes } from "@/utils/constants";
import { BASE_CURRENCY } from "@/utils/fx";
import { getSecondaryHex } from "@/utils/getColorHex";
import * as offlineQueue from "@/utils/offlineQueue";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { format, isThisYear, isToday } from "date-fns";
import { ImagePickerSuccessResult } from "expo-image-picker";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter
} from "expo-router";
import { CalendarDays, Paperclip, Repeat } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import "react-native-get-random-values";
import { v4 as uuid } from "uuid";

// Local-day key (not a UTC ISO date) so the cached daily count is compared
// against the same calendar day the user is in.
const dayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/**
 * The user's expense count for today, usable offline. Online: the live server
 * count, cached for later offline reads. Offline: the last cached server count
 * for today (0 if missing or from another day) plus the ADD_EXPENSE ops queued
 * today — so the free-tier daily limit stays enforced without a server round
 * trip. The two never overlap: queued ops aren't in the cached server count
 * until they sync, at which point the queue is empty again.
 */
async function resolveDailyCount(userId: string): Promise<number> {
  if (await offlineQueue.isOnline()) {
    const count = await services.expense.getDailyExpenseCount(userId);
    await cacheService.saveDailyExpenseCount(userId, count, dayKey());
    return count;
  }
  const cached = await cacheService.getDailyExpenseCount(userId);
  const base = cached && cached.dayKey === dayKey() ? cached.count : 0;
  const queuedToday = await offlineQueue.countExpensesQueuedToday();
  return base + queuedToday;
}

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
  const { details: currentUser, session } = states.user();
  const userId = currentUser?.id ?? session?.user?.id;
  const isPro = currentUser?.plan === "pro";

  const toast = useAppToast();
  const { isOnline } = useNetwork();
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";

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
      currency: scannedCurrency ?? BASE_CURRENCY,
      // Kept so the group-currency sync below can tell an explicit scanned
      // currency (which wins) apart from the plain default.
      scannedCurrency,
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
  const [category, setCategory] = useState<string>(ExpenseCategory.GENERAL);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [expenseDate, setExpenseDate] = useState(seed.expenseDate);
  const [proofOfPayment, setProofOfPayment] =
    useState<ImagePickerSuccessResult | null>(seed.proofOfPayment);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  // Flipped true the first time the user taps a submit action. Until then the
  // form stays quiet; after, the required-field errors (amount, description)
  // render inline so the user can see exactly what's missing. Individual errors
  // clear on their own as each field becomes valid.
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
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
  const [recurrenceSheetOpen, setRecurrenceSheetOpen] = useState(false);
  // null = one-off expense (the default); set = a recurring series.
  const [recurrence, setRecurrence] = useState<RecurrenceConfig | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [upgradeSheetOpen, setUpgradeSheetOpen] = useState(false);
  const [upgradeDescription, setUpgradeDescription] = useState<
    string | undefined
  >(undefined);
  const [dailyCount, setDailyCount] = useState(0);

  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const openDateSheet = useCallback(() => setDateSheetOpen(true), []);
  const closeDateSheet = useCallback(() => setDateSheetOpen(false), []);

  // Optional fields (category / date / repeat / receipt) collapse into a chip
  // row. Always starts closed — the common case is amount + description on the
  // defaults, and anything a scan set to a non-default already shows as a
  // filled-in chip without expanding. Who paid and how it splits stay outside
  // entirely: they're the substance of a group expense, and the one thing a
  // collapsed summary can't stand in for.
  const [optionsExpanded, setOptionsExpanded] = useState(false);
  const handleToggleOptions = () => setOptionsExpanded((prev) => !prev);

  // The scan hand-off has been consumed by the seed initializer above — clear it
  // so leaving and re-entering this screen doesn't re-seed a stale receipt.
  useEffect(() => {
    const { scanDraft, clearScanDraft } = states.expense.getState();
    if (scanDraft) clearScanDraft();
  }, []);

  useEffect(() => {
    if (!isPro && userId) {
      // Offline-aware: falls back to cached + queued-today so the badge still
      // reflects the real remaining count without a server connection.
      resolveDailyCount(userId)
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
      // Offline (or fetch failed) — fall back to the last known roster so the
      // payer and split cards still render and the expense can be queued. Prefer
      // the in-memory group store: it reflects optimistic offline member edits
      // even for a group whose detail was never written to the SQLite cache
      // (e.g. one created offline). Fall back to the cache otherwise.
      const store = states.group.getState();
      const storeMembers =
        store.details?.id === groupId ? store.memberList : [];
      if (storeMembers.length) {
        applyMembers(storeMembers as Member[]);
      } else {
        try {
          const cached = await cacheService.getGroupDetail(groupId);
          if (cached?.memberList?.length) {
            applyMembers(cached.memberList as Member[]);
          }
        } catch {
          // submit stays disabled if there's no cached member list either
        }
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

  // Default the currency to the resolved group's own currency (a Pro "Japan
  // Trip" group is JPY-first). A scanned currency always wins; free groups are
  // "PHP" so this is a no-op for them. Fires when the selected group changes,
  // mirroring the book add-expense flow.
  useEffect(() => {
    if (seed.scannedCurrency) return;
    // A group cached before group-currency shipped has no `currency` — fall back
    // to the home currency so we never set `undefined`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selectedGroup) setCurrency(selectedGroup.currency ?? BASE_CURRENCY);
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
  const leadPayerFirstName = (m?: Member | null) => {
    if (!m) return `${currentUser?.first_name ?? "You"} (You)`;
    return m.id === currentUser?.id ? `${m.first_name} (You)` : m.first_name;
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

  // Repeat row: Pro-only. Free users get the upgrade sheet instead of the
  // recurrence picker (mirrors the currency-lock pattern above).
  const handleOpenRecurrence = () => {
    if (!isPro) {
      setUpgradeDescription(
        "Recurring expenses are a Pro feature. Upgrade to auto-post monthly rent, subscriptions, and other regular bills on a schedule."
      );
      setUpgradeSheetOpen(true);
      return;
    }
    setRecurrenceSheetOpen(true);
  };

  const hasReceipt = !!proofOfPayment;
  const CategoryChipIcon = expenseCategoryMeta(category).icon;

  // The collapsed row. Each chip opens the same sheet its full field does, so
  // changing just the category never costs an expand. A chip renders muted while
  // its field is on the default and fills in once it isn't. Nothing here can be
  // invalid — the only validated fields (amount, description, payers, split) all
  // stay visible — so no chip needs an error state.
  const optionChips: ExpenseOptionChip[] = [
    {
      key: "category",
      label: expenseCategoryMeta(category).label,
      isDefault: category === ExpenseCategory.GENERAL,
      icon: (color) => <CategoryChipIcon size={16} color={color} />,
      onPress: () => setCategorySheetOpen(true)
    },
    {
      key: "date",
      label: isToday(expenseDate)
        ? "Today"
        : // Drop the year for the current one — "Aug 12" reads better in a chip,
          // but a back-dated expense from last year must stay unambiguous.
          format(
            expenseDate,
            isThisYear(expenseDate) ? "MMM dd" : "MMM dd, yyyy"
          ),
      isDefault: isToday(expenseDate),
      icon: (color) => <CalendarDays size={16} color={color} />,
      onPress: openDateSheet
    },
    {
      key: "repeat",
      label: recurrence
        ? recurrenceSummary(recurrence)
        : isPro
          ? "One-time"
          : "One-time · Pro",
      isDefault: !recurrence,
      icon: (color) => <Repeat size={16} color={color} />,
      onPress: handleOpenRecurrence
    },
    {
      key: "receipt",
      label: hasReceipt ? "Receipt added" : "Receipt",
      isDefault: !hasReceipt,
      icon: (color) => <Paperclip size={16} color={color} />,
      // The one chip that expands instead of opening a sheet: the uploader is a
      // preview surface, not a value a sheet can hand back.
      onPress: () => setOptionsExpanded(true)
    }
  ];

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

  // Required-field errors, only surfaced once a submit has been attempted so
  // the form doesn't nag before the user has tried anything.
  const amountError =
    attemptedSubmit && parsedAmount <= 0 ? "Enter an amount." : undefined;
  const descriptionError =
    attemptedSubmit && description.trim().length === 0
      ? "Enter a description."
      : undefined;

  // A draft only needs an amount, a description, and a group — no payers or
  // split yet ("log now, split later"). Deliberately looser than canSubmit,
  // which also requires a valid payer/split and 2+ people involved.
  const canSaveDraft =
    parsedAmount > 0 &&
    description.trim().length > 0 &&
    !savingDraft &&
    !submitting &&
    !!currentUser &&
    !!selectedGroup;

  const handleSaveDraft = async () => {
    if (!currentUser || !selectedGroup) return;

    // Drafts are a Pro feature — free users see the upgrade sheet.
    if (!isPro) {
      setUpgradeDescription(
        "Draft Expenses is a Pro feature. Upgrade to log an expense now and finalize who paid and how to split it later."
      );
      setUpgradeSheetOpen(true);
      return;
    }

    setAttemptedSubmit(true);
    if (!canSaveDraft) return;

    const creator = {
      id: currentUser.id,
      email: currentUser.email,
      phone: currentUser.phone,
      first_name: currentUser.first_name,
      last_name: currentUser.last_name,
      avatar: currentUser.avatar,
      plan: currentUser.plan
    };

    // Offline → queue the draft optimistically. A draft has no payments, so
    // only the expense preview is injected; any attached receipt is stashed and
    // re-uploaded after the draft syncs (uploads are blocked offline).
    const online = await offlineQueue.isOnline();
    if (!online) {
      const clientId = uuid();
      const optimistic = offlineQueue.buildOptimisticDraft({
        clientId,
        groupId: selectedGroup.id,
        amount: parsedAmount,
        description: description.trim(),
        currency,
        category,
        creator
      });

      const proofAsset = proofOfPayment?.assets?.[0];
      const proofUpload = proofAsset
        ? { uri: proofAsset.uri, fileName: proofAsset.fileName ?? null }
        : undefined;

      await offlineQueue.queueCreateDraft(
        selectedGroup.id,
        {
          expensePayload: {
            amount: parsedAmount,
            description: description.trim(),
            proof_of_payment: null,
            group_id: selectedGroup.id,
            currency,
            category,
            expense_date: expenseDate.toISOString()
          }
        },
        optimistic,
        proofUpload
      );

      toast({
        title: "Draft saved offline",
        description: proofUpload
          ? "This draft and its receipt will sync automatically when you're back online."
          : "This draft will sync automatically when you're back online.",
        type: "info"
      });
      router.back();
      return;
    }

    setSavingDraft(true);
    try {
      const response = await services.expense.saveDraftExpense({
        amount: parsedAmount,
        description: description.trim(),
        proof_of_payment: proofOfPayment,
        group_id: selectedGroup.id,
        currency,
        category,
        expense_date: expenseDate
      });

      if (!response) throw new Error("Failed to save draft");

      toast({
        title: "Draft Saved",
        description: "Finalize it later to set who paid and split it.",
        type: "success"
      });
      router.back();
    } catch {
      toast({
        title: "Draft Save Failed",
        description:
          "An error occurred while saving the draft. Please try again.",
        type: "error"
      });
    } finally {
      setSavingDraft(false);
    }
  };

  // A recurring series is a server-side template (materialized by the cron
  // Edge Function), so it can't be queued offline. Reuses the same resolved
  // payers/splits/payments the one-off path builds.
  const handleSubmitRecurring = async () => {
    if (!currentUser || !selectedGroup || !canSubmit || !recurrence) return;

    const online = await offlineQueue.isOnline();
    if (!online) {
      toast({
        title: "You're offline",
        description:
          "Recurring expenses need a connection. Reconnect to set one up.",
        type: "info"
      });
      return;
    }

    setSubmitting(true);
    try {
      const memberSplits = buildMemberSplits();
      const payersArr = buildPayers();
      const paymentSplits = generatePaymentSplits(payersArr, memberSplits);

      await services.expense.saveRecurringExpense(
        {
          group_id: selectedGroup.id,
          amount: parsedAmount,
          description: description.trim(),
          currency,
          category,
          split_type: splitType,
          recurrence,
          proof_of_payment: proofOfPayment
        },
        payersArr,
        memberSplits,
        paymentSplits
      );

      toast({
        title: "Recurring Expense Set",
        description:
          recurrenceSummary(recurrence) + " — we'll post it for you.",
        type: "success"
      });
      router.back();
    } catch {
      toast({
        title: "Failed",
        description:
          "Could not set up the recurring expense. Please try again.",
        type: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    setAttemptedSubmit(true);
    if (!currentUser || !selectedGroup || !canSubmit) return;

    // A recurrence turns this into a server-side series, not a one-off insert.
    if (recurrence) {
      await handleSubmitRecurring();
      return;
    }

    // Offline → queue the expense optimistically.
    const online = await offlineQueue.isOnline();
    if (!online) {
      // The daily limit still applies offline — enforce it against the cached
      // server count + expenses already queued today so free users can't bypass
      // it by going offline (they all sync later against the same limit).
      if (!isPro) {
        const count = await resolveDailyCount(currentUser.id);
        if (count >= DAILY_EXPENSE_LIMIT) {
          setUpgradeDescription(
            "You've reached your 5 expense limit for today. Upgrade to Pro for unlimited expenses."
          );
          setUpgradeSheetOpen(true);
          return;
        }
      }

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
        category,
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

      // Stash any attached receipt so it re-uploads once we're back online — the
      // expense row can't carry an uploaded image while offline, but the local
      // file is kept and pushed on sync instead of being dropped.
      const proofAsset = proofOfPayment?.assets?.[0];
      const proofUpload = proofAsset
        ? { uri: proofAsset.uri, fileName: proofAsset.fileName ?? null }
        : undefined;

      await offlineQueue.queueAddExpense(
        selectedGroup.id,
        {
          expensePayload: {
            amount: parsedAmount,
            description: description.trim(),
            // The insert can't reference an uploaded image offline — the proof
            // is re-uploaded from `proofUpload` after this op syncs.
            proof_of_payment: null,
            group_id: selectedGroup.id,
            split_type: splitType,
            currency,
            category,
            expense_date: expenseDate.toISOString()
          },
          payers: payersArr,
          memberSplits,
          paymentSplits
        },
        optimistic,
        optimisticPayments,
        members,
        proofUpload
      );

      toast({
        title: "Saved offline",
        description: proofUpload
          ? "This expense and its receipt will sync automatically when you're back online."
          : "This expense will sync automatically when you're back online.",
        type: "info"
      });
      router.back();
      return;
    }

    if (!isPro) {
      // resolveDailyCount also refreshes the cached count that offline
      // enforcement reads from.
      const count = await resolveDailyCount(currentUser.id);
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
          category,
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
                You&apos;re not in a group yet. Join or create one to add an
                expense.
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
        androidActions={
          !isPro ? (
            <Box className="pr-1">
              <DailyLimitBadge count={dailyCount} limit={DAILY_EXPENSE_LIMIT} />
            </Box>
          ) : undefined
        }
        onBack={() => router.back()}
        footer={[
          <FormButton
            key="add-expense-draft"
            className="flex-1"
            variant="outline"
            text={isPro ? "Save Draft" : "Save Draft - Pro"}
            loading={savingDraft}
            // Stays enabled even with fields missing — tapping surfaces the
            // required-field errors instead. Only genuinely blocking states
            // disable it: another action in flight, or a recurrence set (drafts
            // and recurrence don't combine — a series posts finalized
            // occurrences, so there's nothing to "finalize later").
            disabled={submitting || !!recurrence}
            onPress={handleSaveDraft}
          />,
          <FormButton
            key="add-expense-submit"
            className="flex-1"
            text={recurrence ? "Save Recurring" : "Add Expense"}
            loading={submitting}
            // Stays enabled even with fields missing — tapping runs validation
            // and surfaces the errors rather than silently doing nothing.
            disabled={savingDraft}
            onPress={handleSubmit}
          />
        ]}
      >
        <ScrollView className="flex-1 px-4">
          <VStack className="gap-y-6 pt-2 pb-4">
            <FormControl size="md" isInvalid={!!amountError}>
              <FormControlLabel>
                <FormControlLabelText>Amount</FormControlLabelText>
              </FormControlLabel>
              <HStack className="gap-x-2 items-end h-14">
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
              {amountError && (
                <FormControlError>
                  <FormControlErrorText>{amountError}</FormControlErrorText>
                </FormControlError>
              )}
            </FormControl>

            <FormTextarea
              label="Description"
              placeholder="Enter description (e.g., Dinner at KFC Baguio)"
              value={description}
              onChangeText={setDescription}
              autoCapitalize="none"
              size="sm"
              errorMessage={descriptionError}
            />

            {fieldsLoading ? (
              <VStack className="gap-y-6">
                <PayerFieldSkeleton />
                <GroupCardSkeleton />
              </VStack>
            ) : memberCount > 0 ? (
              /* Group + who paid + how it splits, as one card of tappable rows.
                 Each row opens the sheet it summarizes, so the payer field no
                 longer needs a slot of its own above the card. */
              <FormControl size="md">
                <VStack
                  className={cn(
                    "border rounded-lg overflow-hidden",
                    !splitValid || !payersValid
                      ? "border-error-300"
                      : "border-background-200"
                  )}
                >
                  {/* Top: group name + group changer. Pressable only when the
                      group isn't fixed by the route. */}
                  {!isLocked ? (
                    <PressableListItem
                      onPress={() => setGroupPickerOpen(true)}
                      className="p-4"
                    >
                      <HStack className="items-center gap-x-2">
                        <Text
                          bold
                          className="text-sm text-secondary-950 uppercase flex-1"
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
                    </PressableListItem>
                  ) : (
                    <Box className="p-4">
                      <Text
                        bold
                        className="text-sm text-secondary-950 uppercase"
                        numberOfLines={1}
                      >
                        {selectedGroup?.name}
                      </Text>
                    </Box>
                  )}

                  {/* Paid by → the payer contribution sheet. */}
                  <PressableListItem
                    onPress={handleOpenPayerSheet}
                    className="h-20 justify-center px-4 border-t border-background-200"
                  >
                    <HStack className="items-center gap-x-3">
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
                          size="md"
                          uri={
                            payerMembers[0]?.avatar ?? currentUser?.avatar ?? ""
                          }
                        />
                      )}
                      <VStack className="flex-1">
                        <Text className="text-sm text-secondary-950">
                          Paid by
                        </Text>
                        <Text className="text-lg" numberOfLines={1}>
                          {payerLabel}
                        </Text>
                      </VStack>
                      <Icon
                        as="chevron-right"
                        size={20}
                        className="text-secondary-950"
                      />
                    </HStack>
                  </PressableListItem>

                  {!payersValid && (
                    <Text className="text-sm text-error-500 px-4 pb-3">
                      Contributions must add up to{" "}
                      {formatAmount(parsedAmount, currency)}.
                    </Text>
                  )}

                  {/* Split → the split sheet. The per-person figure only reads
                      as "each" on an equal split; the other modes are per-member
                      and belong in the breakdown below. */}
                  <PressableListItem
                    onPress={handleOpenSplitSheet}
                    className="h-20 justify-center px-4 border-t border-background-200"
                  >
                    <HStack className="items-center gap-x-3">
                      <AppAvatarGroup
                        items={splitAvatars}
                        size="sm"
                        maxDisplay={3}
                      />
                      <VStack className="flex-1">
                        <Text className="text-sm text-secondary-950">
                          {splitTypeLabel}
                        </Text>
                        <Text className="text-lg" numberOfLines={1}>
                          {splitAmongText}
                        </Text>
                      </VStack>
                      {splitType === "equal" && (
                        <VStack className="items-end">
                          <Text
                            bold
                            className="text-2xl text-primary-500"
                            numberOfLines={1}
                          >
                            {formatAmount(perIncluded, currency)}
                          </Text>
                          <Text className="text-secondary-950 text-sm">
                            each
                          </Text>
                        </VStack>
                      )}
                      <Icon
                        as="chevron-right"
                        size={20}
                        className="text-secondary-950"
                      />
                    </HStack>
                  </PressableListItem>

                  {!splitValid && (
                    <Text className="text-sm text-error-500 px-4 pb-3">
                      {splitError}
                    </Text>
                  )}

                  {/* Per-person breakdown: name + % + amount. */}
                  <PressableListItem
                    onPress={() => setShowBreakdown((prev) => !prev)}
                    className="px-4 py-3 border-t border-background-200"
                  >
                    <HStack className="items-center justify-center gap-x-1">
                      <Text bold className="text-sm text-primary-500">
                        {showBreakdown ? "Hide breakdown" : "Show breakdown"}
                      </Text>
                      <Icon
                        as={showBreakdown ? "expand-less" : "expand-more"}
                        size={18}
                        className="text-primary-500"
                      />
                    </HStack>
                  </PressableListItem>

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
            ) : (
              // Members couldn't be resolved — offline with no cached roster for
              // this group (never opened/prefetched while online), or a failed
              // fetch. Explain it instead of leaving a silently-disabled submit,
              // and keep a way to switch to a group we *can* load (the changer
              // normally lives inside the split card, which is hidden here).
              <VStack className="border border-background-200 rounded-lg p-4 gap-y-3 items-center">
                <Icon as="cloud-off" size={40} className="text-secondary-400" />
                <VStack className="gap-y-1 items-center">
                  <Text bold className="text-center">
                    Members aren&apos;t available for this group
                  </Text>
                  <Text className="text-center text-sm text-secondary-950">
                    {isOnline
                      ? "We couldn't load this group's members. Check your connection and try again."
                      : "You're offline and this group's members haven't been saved for offline use yet. Open it once while you're online, then you can add expenses here offline."}
                  </Text>
                </VStack>
                {!isLocked && (
                  <FormButton
                    size="sm"
                    variant="outline"
                    text="Choose another group"
                    onPress={() => setGroupPickerOpen(true)}
                  />
                )}
              </VStack>
            )}

            {/* Everything below has a working default, so it collapses to the
                chip row until the user wants it. */}
            <ExpenseOptions
              chips={optionChips}
              expanded={optionsExpanded}
              onToggle={handleToggleOptions}
            >
              <HStack className="gap-x-2">
                <FormControl size="md" className="flex-1">
                  <FormControlLabel>
                    <FormControlLabelText>Category</FormControlLabelText>
                  </FormControlLabel>
                  <SelectField
                    onPress={() => setCategorySheetOpen(true)}
                    leading={
                      <CategoryIcon icon={expenseCategoryMeta(category).icon} />
                    }
                  >
                    <Text className="text-lg" numberOfLines={1}>
                      {expenseCategoryMeta(category).label}
                    </Text>
                  </SelectField>
                </FormControl>

                <FormControl size="md" className="flex-1">
                  <FormControlLabel>
                    <FormControlLabelText>Expense Date</FormControlLabelText>
                  </FormControlLabel>
                  <SelectField
                    onPress={openDateSheet}
                    leading={
                      <CalendarDays
                        color={getSecondaryHex(
                          "text-secondary-950",
                          colorScheme
                        )}
                      />
                    }
                  >
                    <Text className="text-lg" numberOfLines={1}>
                      {format(expenseDate, "MMM dd, yyyy")}
                    </Text>
                  </SelectField>
                </FormControl>
              </HStack>

              <FormControl size="md">
                <FormControlLabel>
                  <FormControlLabelText>Repeat</FormControlLabelText>
                </FormControlLabel>
                <SelectField
                  onPress={handleOpenRecurrence}
                  leading={
                    <Repeat
                      size={22}
                      color={getSecondaryHex("text-secondary-950", colorScheme)}
                    />
                  }
                >
                  <Text className="text-lg">
                    {recurrence
                      ? recurrenceSummary(recurrence)
                      : isPro
                        ? "One-time"
                        : "One-time - Pro"}
                  </Text>
                </SelectField>
                {recurrence && (
                  <Text className="text-sm text-secondary-950 mt-1">
                    First expense posts now, the rest automatically.
                  </Text>
                )}
              </FormControl>

              <VStack className="gap-y-1">
                <UploadImage
                  title="Upload Proof of Payment (optional)"
                  key={proofOfPayment?.assets?.[0]?.uri ?? "none"}
                  defaultUri={proofOfPayment?.assets?.[0]?.uri ?? null}
                  onSelect={setProofOfPayment}
                />
                <Text className="text-secondary-950 text-sm">
                  A receipt photo, payment screenshot, or any proof of the
                  expense.
                </Text>
              </VStack>
            </ExpenseOptions>
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
          // Percentage / custom splits are hard to read at a glance, so reveal
          // the per-person breakdown by default when either is chosen.
          if (nextType !== "equal") setShowBreakdown(true);
          setSplitSheetOpen(false);
        }}
      />

      <CategorySheet
        isOpen={categorySheetOpen}
        category={category}
        onClose={() => setCategorySheetOpen(false)}
        onSelect={setCategory}
      />

      <RecurrenceSheet
        isOpen={recurrenceSheetOpen}
        value={recurrence}
        onClose={() => setRecurrenceSheetOpen(false)}
        onDone={(next) => {
          setRecurrence(next);
          setRecurrenceSheetOpen(false);
        }}
      />

      <UpgradeSheet
        isOpen={upgradeSheetOpen}
        onClose={() => setUpgradeSheetOpen(false)}
        description={upgradeDescription}
      />

      <DatePickerModal
        isOpen={dateSheetOpen}
        onClose={closeDateSheet}
        value={expenseDate}
        onChange={setExpenseDate}
      />
    </>
  );
}
