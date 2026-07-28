import AmountInput from "@/components/AmountInput";
import CategoryIcon from "@/components/CategoryIcon";
import CurrencySelection from "@/components/CurrencySelection";
import DailyLimitBadge from "@/components/DailyLimitBadge";
import FormButton from "@/components/FormButton";
import FormTextarea from "@/components/FormTextarea";
import SelectField from "@/components/SelectField";
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
  FormControlError,
  FormControlErrorText,
  FormControlLabel,
  FormControlLabelText
} from "@/components/ui/form-control";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import UploadImage from "@/components/UploadImage";
import UpgradeSheet from "@/components/UpgradeSheet";
import CategorySheet, {
  expenseCategoryMeta
} from "@/features/expense/components/CategorySheet";
import useAppToast from "@/hooks/use-app-toast";
import FormLayout from "@/layouts/FormLayout";
import services from "@/services";
import states from "@/states";
import { ExpenseCategory } from "@/types/expenses";
import { cacheService } from "@/utils/cacheService";
import { currencies, PERSONAL_EXPENSE_LIMIT } from "@/utils/constants";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import * as offlineQueue from "@/utils/offlineQueue";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { CalendarDays } from "lucide-react-native";
import { Fragment, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { ImagePickerSuccessResult } from "expo-image-picker";
import "react-native-get-random-values";
import { v4 as uuid } from "uuid";

// Local-day key so the cached daily count is compared against the same calendar
// day the user is in (mirrors the group add-expense flow).
const dayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/**
 * The user's personal-expense count for today, usable offline. Online: the live
 * server count, cached for later. Offline: the last cached server count for
 * today plus the ADD_PERSONAL_EXPENSE ops queued today — keeping the 5/day free
 * limit enforced without a server round trip.
 */
async function resolvePersonalDailyCount(userId: string): Promise<number> {
  if (await offlineQueue.isOnline()) {
    const count = await services.bookExpense.getDailyPersonalCount(userId);
    await cacheService.saveDailyPersonalCount(userId, count, dayKey());
    return count;
  }
  const cached = await cacheService.getDailyPersonalCount(userId);
  const base = cached && cached.dayKey === dayKey() ? cached.count : 0;
  const queuedToday = await offlineQueue.countPersonalExpensesQueuedToday();
  return base + queuedToday;
}

export default function AddPersonalExpenseScreen() {
  const params = useLocalSearchParams<{ bookId: string; expenseId?: string }>();
  const bookId = params.bookId;
  const expenseId =
    typeof params.expenseId === "string" ? params.expenseId : undefined;
  const isEdit = !!expenseId;

  const { details: userDetails, defaultCurrency } = states.user();
  const isPro = userDetails?.plan === "pro";

  const router = useRouter();
  const toast = useAppToast();
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";

  // Seed from a Scan Receipt (Beta) hand-off if one is waiting (ADD mode only).
  // Read once at mount; the draft is cleared in the effect below so a back-out +
  // re-entry starts clean. Scanned currency is honored only for Pro and only for
  // a supported currency (mirrors the group add-expense flow).
  const [seed] = useState(() => {
    if (isEdit) return null;
    const draft = states.expense.getState().scanDraft;
    if (!draft) return null;
    const scannedCurrency =
      isPro &&
      draft.currency &&
      currencies.some((c) => c.value === draft.currency)
        ? draft.currency
        : null;
    const scannedDate = draft.date ? new Date(draft.date) : null;
    return {
      amount: draft.amount ?? "",
      description: draft.description ?? "",
      currency: scannedCurrency,
      expenseDate:
        scannedDate && !isNaN(scannedDate.getTime()) ? scannedDate : null,
      proofOfPayment: draft.proof_of_payment as ImagePickerSuccessResult
    };
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // Scanned currency (if any) wins; otherwise the book's currency is filled in
  // once it loads. Default until then.
  const [currency, setCurrency] = useState(
    seed?.currency ?? (isPro ? defaultCurrency : "PHP")
  );
  const [dailyCount, setDailyCount] = useState(0);

  const [amount, setAmount] = useState(seed?.amount ?? "");
  const [description, setDescription] = useState(seed?.description ?? "");
  const [category, setCategory] = useState<string>(ExpenseCategory.GENERAL);
  const [expenseDate, setExpenseDate] = useState(seed?.expenseDate ?? new Date());
  const [proofOfPayment, setProofOfPayment] =
    useState<ImagePickerSuccessResult | null>(seed?.proofOfPayment ?? null);
  const [existingProofUrl, setExistingProofUrl] = useState<string | null>(null);
  // The pre-edit amount/currency, so an offline edit can back the old value out
  // of the cached book totals before folding the new one in.
  const [original, setOriginal] = useState<{
    amount: number;
    currency: string;
  } | null>(null);

  const [amountError, setAmountError] = useState("");
  const [descriptionError, setDescriptionError] = useState("");
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeDescription, setUpgradeDescription] = useState<
    string | undefined
  >();

  // Hydrate: the book's currency (inherited by every expense) + title, the
  // existing expense in edit mode, and the free-tier daily count.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [book, expense, count] = await Promise.all([
          services.book.getBookById(bookId),
          isEdit
            ? services.bookExpense.getPersonalExpenseById(expenseId)
            : Promise.resolve(null),
          !isPro && userDetails?.id
            ? resolvePersonalDailyCount(userDetails.id)
            : Promise.resolve(0)
        ]);
        if (!active) return;
        // A scanned currency (Pro) wins; otherwise inherit the book's currency.
        if (!seed?.currency) setCurrency(book.currency);
        setDailyCount(count);
        if (expense) {
          setAmount(String(expense.amount));
          setDescription(expense.description);
          setCategory(expense.category);
          setExpenseDate(new Date(expense.expense_date));
          setExistingProofUrl(expense.proof_of_payment);
          // An edited expense keeps its own currency if it differs from the book.
          setCurrency(expense.currency);
          setOriginal({ amount: expense.amount, currency: expense.currency });
        }
      } catch {
        toast({
          title: "Error",
          description: "Couldn't load this expense. Please try again.",
          type: "error"
        });
        router.back();
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [bookId, expenseId]);

  // Consume the scan hand-off once seeded, so backing out + re-entering starts
  // from a clean form.
  useEffect(() => {
    const { scanDraft, clearScanDraft } = states.expense.getState();
    if (scanDraft) clearScanDraft();
  }, []);

  const validate = () => {
    const parsed = parseFloat(amount);
    const nextAmountError =
      !amount || isNaN(parsed) || parsed <= 0
        ? "Enter an amount greater than 0"
        : "";
    const nextDescriptionError = description.trim()
      ? ""
      : "Description is required";
    setAmountError(nextAmountError);
    setDescriptionError(nextDescriptionError);
    return !nextAmountError && !nextDescriptionError;
  };

  const handleSubmit = async () => {
    if (!validate() || !userDetails?.id) return;

    const parsedAmount = parseFloat(amount);
    const trimmedDescription = description.trim();

    // Free-tier gate (ADD only) — re-resolve so same-session/offline adds count
    // toward today's limit, not just the value read on mount.
    if (!isEdit && !isPro) {
      const count = await resolvePersonalDailyCount(userDetails.id);
      setDailyCount(count);
      if (count >= PERSONAL_EXPENSE_LIMIT) {
        setUpgradeDescription(
          "You've reached your 5 personal expenses for today. Upgrade to Pro for unlimited expenses."
        );
        setUpgradeOpen(true);
        return;
      }
    }

    // Offline → queue + optimistic cache. A receipt picked before going offline
    // is stashed on-device and re-uploaded once the expense syncs.
    if (!(await offlineQueue.isOnline())) {
      const proofAsset = proofOfPayment?.assets?.[0];
      const proofUpload = proofAsset
        ? { uri: proofAsset.uri, fileName: proofAsset.fileName ?? null }
        : undefined;
      if (isEdit) {
        const optimistic = offlineQueue.buildOptimisticPersonalExpense({
          clientId: expenseId!,
          bookId,
          userId: userDetails.id,
          amount: parsedAmount,
          description: trimmedDescription,
          category,
          currency,
          expenseDate: expenseDate.toISOString()
        });
        await offlineQueue.queueUpdatePersonalExpense(
          bookId,
          expenseId!,
          {
            amount: parsedAmount,
            description: trimmedDescription,
            category,
            currency,
            expense_date: expenseDate.toISOString(),
            proof_of_payment: null,
            existing_proof_url: existingProofUrl
          },
          optimistic,
          original?.amount ?? parsedAmount,
          original?.currency ?? currency,
          proofUpload
        );
      } else {
        const clientId = uuid();
        const optimistic = offlineQueue.buildOptimisticPersonalExpense({
          clientId,
          bookId,
          userId: userDetails.id,
          amount: parsedAmount,
          description: trimmedDescription,
          category,
          currency,
          expenseDate: expenseDate.toISOString()
        });
        await offlineQueue.queueAddPersonalExpense(
          bookId,
          {
            book_id: bookId,
            user_id: userDetails.id,
            amount: parsedAmount,
            description: trimmedDescription,
            category,
            currency,
            expense_date: expenseDate.toISOString(),
            proof_of_payment: null
          },
          optimistic,
          proofUpload
        );
      }
      toast({
        title: "Saved offline",
        description: "Your expense will sync when you're back online.",
        type: "info"
      });
      router.back();
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        await services.bookExpense.updatePersonalExpense(expenseId!, {
          amount: parsedAmount,
          description: trimmedDescription,
          category,
          currency,
          expense_date: expenseDate,
          proof_of_payment: proofOfPayment,
          existing_proof_url: existingProofUrl
        });
        toast({
          title: "Expense updated",
          description: "Your changes have been saved.",
          type: "success"
        });
      } else {
        await services.bookExpense.savePersonalExpense({
          book_id: bookId,
          user_id: userDetails.id,
          amount: parsedAmount,
          description: trimmedDescription,
          category,
          currency,
          expense_date: expenseDate,
          proof_of_payment: proofOfPayment
        });
        toast({
          title: "Expense added",
          description: "Your expense has been recorded.",
          type: "success"
        });
      }
      router.back();
    } catch (error) {
      console.error("Failed to save personal expense:", error);
      toast({
        title: isEdit ? "Update Failed" : "Add Expense Failed",
        description: "An error occurred. Please try again.",
        type: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Fragment>
      <FormLayout
        title={isEdit ? "Edit Expense" : "Add Expense"}
        onBack={() => router.back()}
        actions={
          !isPro && !isEdit ? (
            <Stack.Toolbar.View>
              <DailyLimitBadge
                count={dailyCount}
                limit={PERSONAL_EXPENSE_LIMIT}
              />
            </Stack.Toolbar.View>
          ) : undefined
        }
        androidActions={
          !isPro && !isEdit ? (
            <Box className="pr-1">
              <DailyLimitBadge
                count={dailyCount}
                limit={PERSONAL_EXPENSE_LIMIT}
              />
            </Box>
          ) : undefined
        }
        footer={[
          <FormButton
            key="save"
            className="flex-1"
            text={isEdit ? "Save" : "Add Expense"}
            loading={submitting}
            disabled={loading}
            onPress={handleSubmit}
          />
        ]}
      >
        <ScrollView className="flex-1 px-4">
          <VStack className="gap-y-6 pt-2">
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
                      "Multi-currency expenses are a Pro feature. Upgrade to track spending in any currency."
                    );
                    setUpgradeOpen(true);
                  }}
                />
                <VStack className="flex-1">
                  <AmountInput
                    className="h-full"
                    placeholder="0.00"
                    value={amount}
                    onChangeText={(text) => {
                      setAmount(text);
                      if (amountError) setAmountError("");
                    }}
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
              placeholder="Enter description (e.g., Lunch at Jollibee)"
              value={description}
              onChangeText={(text: string) => {
                setDescription(text);
                if (descriptionError) setDescriptionError("");
              }}
              autoCapitalize="none"
              size="sm"
              errorMessage={descriptionError}
            />

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
                  onPress={() => setDateSheetOpen(true)}
                  leading={
                    <CalendarDays
                      color={getSecondaryHex("text-secondary-950", colorScheme)}
                    />
                  }
                >
                  <Text className="text-lg" numberOfLines={1}>
                    {format(expenseDate, "MMM dd, yyyy")}
                  </Text>
                </SelectField>
              </FormControl>
            </HStack>

            <VStack className="gap-y-1 pb-4">
              <UploadImage
                title="Upload Proof of Payment (optional)"
                key={proofOfPayment?.assets?.[0]?.uri ?? existingProofUrl ?? "none"}
                defaultUri={proofOfPayment?.assets?.[0]?.uri ?? existingProofUrl}
                onSelect={setProofOfPayment}
              />
              <Text className="text-secondary-950 text-sm">
                Proof could be a photo of a receipt, a payment screenshot, or any
                document that shows the expense details.
              </Text>
            </VStack>
          </VStack>
        </ScrollView>
      </FormLayout>

      <CategorySheet
        isOpen={categorySheetOpen}
        category={category}
        onClose={() => setCategorySheetOpen(false)}
        onSelect={setCategory}
      />

      <Actionsheet isOpen={dateSheetOpen} onClose={() => setDateSheetOpen(false)}>
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
                onNeutralButtonPress={() => setDateSheetOpen(false)}
                onChange={(_, date) => {
                  if (date) {
                    setExpenseDate(date);
                    setDateSheetOpen(false);
                  }
                }}
              />
            </VStack>
          </VStack>
        </ActionsheetContent>
      </Actionsheet>

      <UpgradeSheet
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        description={upgradeDescription}
      />
    </Fragment>
  );
}
