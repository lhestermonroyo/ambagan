import AmountInput from "@/components/AmountInput";
import AppAvatar from "@/components/AppAvatar";
import CategoryIcon from "@/components/CategoryIcon";
import CurrencySelection from "@/components/CurrencySelection";
import DailyLimitBadge from "@/components/DailyLimitBadge";
import DatePickerModal from "@/components/DatePickerModal";
import FormButton from "@/components/FormButton";
import FormTextarea from "@/components/FormTextarea";
import Icon from "@/components/Icon";
import SelectField from "@/components/SelectField";
import { Box } from "@/components/ui/box";
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlLabel,
  FormControlLabelText
} from "@/components/ui/form-control";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader
} from "@/components/ui/modal";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import UpgradeSheet from "@/components/UpgradeSheet";
import UploadImage from "@/components/UploadImage";
import BookPickerSheet from "@/features/book/components/BookPickerSheet";
import PersonalExpenseStatusSheet from "@/features/book/components/PersonalExpenseStatusSheet";
import CategorySheet, {
  expenseCategoryMeta
} from "@/features/expense/components/CategorySheet";
import RecurrenceSheet from "@/features/expense/components/RecurrenceSheet";
import { recurrenceSummary } from "@/features/expense/utils/recurrence.util";
import useAppToast from "@/hooks/use-app-toast";
import FormLayout from "@/layouts/FormLayout";
import services from "@/services";
import states from "@/states";
import { Book, PersonalExpenseStatus } from "@/types/books";
import { ExpenseCategory, RecurrenceConfig } from "@/types/expenses";
import { cacheService } from "@/utils/cacheService";
import { currencies, PERSONAL_EXPENSE_LIMIT } from "@/utils/constants";
import { getSecondaryHex } from "@/utils/getColorHex";
import * as offlineQueue from "@/utils/offlineQueue";
import { format } from "date-fns";
import { ImagePickerSuccessResult } from "expo-image-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { CalendarDays, Trash2 } from "lucide-react-native";
import { Fragment, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
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
  const bookIdParam = params.bookId;
  // Reached with the literal "[bookId]" segment from Home / Scan (book
  // changeable) or with a real id from a book screen (book locked). Edit always
  // arrives with a real id, so it's locked too.
  const isLocked = !!bookIdParam && bookIdParam !== "[bookId]";
  const expenseId =
    typeof params.expenseId === "string" ? params.expenseId : undefined;
  const isEdit = !!expenseId;

  const { details: userDetails, defaultCurrency } = states.user();
  const { list: bookList } = states.book();
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

  // Two-stage load: resolve which book we're adding to, then (edit) its expense
  // + the daily count. The form stays skeletoned until both settle.
  const [bookResolved, setBookResolved] = useState(false);
  const [detailLoaded, setDetailLoaded] = useState(false);
  const loading = !bookResolved || !detailLoaded;
  const [submitting, setSubmitting] = useState(false);
  // The book this expense belongs to. Locked → the routed book; unlocked →
  // defaults to the most recent book and is changeable via the picker.
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  // Scanned currency (if any) wins; otherwise the book's currency is filled in
  // once it loads. Default until then.
  const [currency, setCurrency] = useState(
    seed?.currency ?? (isPro ? defaultCurrency : "PHP")
  );
  const [dailyCount, setDailyCount] = useState(0);

  const [amount, setAmount] = useState(seed?.amount ?? "");
  const [description, setDescription] = useState(seed?.description ?? "");
  const [category, setCategory] = useState<string>(ExpenseCategory.GENERAL);
  const [expenseDate, setExpenseDate] = useState(
    seed?.expenseDate ?? new Date()
  );
  // Paid by default — most logged expenses are already spent; the user flips to
  // Pending for an upcoming/unpaid bill. In edit mode it's hydrated below.
  const [status, setStatus] = useState<PersonalExpenseStatus>("paid");
  const [proofOfPayment, setProofOfPayment] =
    useState<ImagePickerSuccessResult | null>(seed?.proofOfPayment ?? null);
  const [existingProofUrl, setExistingProofUrl] = useState<string | null>(null);
  // The pre-edit amount/currency, so an offline edit can back the old value out
  // of the cached book totals before folding the new one in.
  const [original, setOriginal] = useState<{
    amount: number;
    currency: string;
    status: PersonalExpenseStatus;
  } | null>(null);

  const [amountError, setAmountError] = useState("");
  const [descriptionError, setDescriptionError] = useState("");
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeDescription, setUpgradeDescription] = useState<
    string | undefined
  >();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [recurrenceSheetOpen, setRecurrenceSheetOpen] = useState(false);
  // null = one-off expense (the default); set = a recurring series.
  const [recurrence, setRecurrence] = useState<RecurrenceConfig | null>(null);

  // Resolve which book we're adding to. Locked → fetch the routed book. Unlocked
  // (from Home / Scan) → default to the most recent book, fetching the list once
  // if the store is empty. No books resolves to null → the empty state below.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (isLocked) {
          const book = await services.book.getBookById(bookIdParam);
          if (active) setSelectedBook(book);
        } else {
          let books = states.book.getState().list;
          if (books.length === 0 && userDetails?.id) {
            try {
              const res = await services.book.getBooksByUserIdPaginated(
                userDetails.id,
                0,
                "all"
              );
              books = res.data;
              states.book.setState((prev) => ({ ...prev, list: res.data }));
            } catch {
              // Offline with no cached list — resolves to no book → empty state.
            }
          }
          if (active) setSelectedBook(books[0] ?? null);
        }
      } catch {
        if (active) {
          toast({
            title: "Error",
            description: "Couldn't load this book. Please try again.",
            type: "error"
          });
          router.back();
        }
      } finally {
        if (active) setBookResolved(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [isLocked, bookIdParam]);

  // A scanned currency (Pro) wins; otherwise every expense inherits the selected
  // book's currency — re-applied whenever the book changes (skipped in edit,
  // where the expense keeps its own currency).
  useEffect(() => {
    if (isEdit || seed?.currency) return;
    if (selectedBook) setCurrency(selectedBook.currency);
  }, [selectedBook?.id]);

  // Hydrate the existing expense (edit mode) and the free-tier daily count.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [expense, count] = await Promise.all([
          isEdit
            ? services.bookExpense.getPersonalExpenseById(expenseId)
            : Promise.resolve(null),
          !isPro && userDetails?.id
            ? resolvePersonalDailyCount(userDetails.id)
            : Promise.resolve(0)
        ]);
        if (!active) return;
        setDailyCount(count);
        if (expense) {
          setAmount(String(expense.amount));
          setDescription(expense.description);
          setCategory(expense.category);
          setExpenseDate(new Date(expense.expense_date));
          setExistingProofUrl(expense.proof_of_payment);
          setStatus(expense.status);
          // An edited expense keeps its own currency if it differs from the book.
          setCurrency(expense.currency);
          setOriginal({
            amount: expense.amount,
            currency: expense.currency,
            status: expense.status
          });
        }
      } catch {
        toast({
          title: "Error",
          description: "Couldn't load this expense. Please try again.",
          type: "error"
        });
        router.back();
      } finally {
        if (active) setDetailLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [expenseId]);

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

  // Switching book re-defaults the currency to the new book's (via the effect
  // above, keyed on the book id) — matches how the group form re-defaults on a
  // group change.
  const handleChangeBook = (next: Book) => {
    setBookPickerOpen(false);
    if (next.id === selectedBook?.id) return;
    setSelectedBook(next);
  };

  // Repeat row: Pro-only. Free users get the upgrade sheet instead of the
  // recurrence picker (mirrors the currency-lock pattern above and the group
  // Add Expense flow).
  const handleOpenRecurrence = () => {
    if (!isPro) {
      setUpgradeDescription(
        "Recurring expenses are a Pro feature. Upgrade to auto-post monthly rent, subscriptions, and other regular bills on a schedule."
      );
      setUpgradeOpen(true);
      return;
    }
    setRecurrenceSheetOpen(true);
  };

  // A recurring series is a server-side template (materialized by the same cron
  // that posts group recurring expenses), so it's online-only — queuing a
  // template could race a server run.
  const handleSubmitRecurring = async () => {
    if (!validate() || !userDetails?.id || !selectedBook || !recurrence) return;

    if (!(await offlineQueue.isOnline())) {
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
      await services.bookRecurring.savePersonalRecurring({
        book_id: selectedBook.id,
        amount: parseFloat(amount),
        description: description.trim(),
        category,
        currency,
        recurrence
      });
      toast({
        title: "Recurring Expense Set",
        description: `${recurrenceSummary(recurrence)} — we'll post it for you.`,
        type: "success"
      });
      router.back();
    } catch (error) {
      console.error("Failed to save personal recurring expense:", error);
      toast({
        title: "Couldn't set up",
        description: "Could not set up the recurring expense. Please try again.",
        type: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!validate() || !userDetails?.id || !selectedBook) return;

    // A recurrence turns this into a server-side series, not a one-off insert.
    if (recurrence) {
      await handleSubmitRecurring();
      return;
    }

    const bookId = selectedBook.id;
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
          expenseDate: expenseDate.toISOString(),
          status
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
            existing_proof_url: existingProofUrl,
            status
          },
          optimistic,
          original?.amount ?? parsedAmount,
          original?.currency ?? currency,
          original?.status ?? status,
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
          expenseDate: expenseDate.toISOString(),
          status
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
            proof_of_payment: null,
            status
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
          existing_proof_url: existingProofUrl,
          status
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
          proof_of_payment: proofOfPayment,
          status
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

  // Delete (edit mode only) — the personal expense list has no swipe actions, so
  // this header action is the single delete path. Offline → queue + optimistic
  // cache removal (adjusts the cached book totals), same as the online delete.
  const handleDelete = async () => {
    if (!expenseId || !selectedBook) return;
    setDeleting(true);
    try {
      if (!(await offlineQueue.isOnline())) {
        await offlineQueue.queueDeletePersonalExpense(
          selectedBook.id,
          expenseId,
          original?.amount ?? 0,
          original?.currency ?? currency,
          original?.status ?? status
        );
        toast({
          title: "Deleted offline",
          description: "This will sync when you're back online.",
          type: "info"
        });
      } else {
        await services.bookExpense.deletePersonalExpense(expenseId);
        toast({
          title: "Expense deleted",
          description: "The expense has been removed.",
          type: "success"
        });
      }
      setDeleteOpen(false);
      router.back();
    } catch (error) {
      console.error("Failed to delete personal expense:", error);
      toast({
        title: "Error",
        description: "Failed to delete expense. Please try again.",
        type: "error"
      });
    } finally {
      setDeleting(false);
    }
  };

  // Unlocked entry (Home / Scan) but the user has no book yet — mirror the group
  // form's no-group state with a Create Book CTA. Replace so backing out of
  // create doesn't return to this empty form.
  if (bookResolved && !selectedBook) {
    return (
      <FormLayout title="Add Expense" onBack={() => router.back()} footer={[]}>
        <VStack className="flex-1 p-4">
          <VStack className="items-center justify-center flex-1 gap-y-4">
            <Icon
              as="sentiment-dissatisfied"
              size={64}
              className="text-primary-400"
            />
            <Text className="text-center">
              You don&apos;t have a book yet. Create one to start tracking your
              personal expenses.
            </Text>
            <FormButton
              text="Create Book"
              iconEnd={
                <Icon as="chevron-right" className="text-background-0" />
              }
              onPress={() => router.replace("/books/create")}
            />
          </VStack>
        </VStack>
      </FormLayout>
    );
  }

  return (
    <Fragment>
      <FormLayout
        title={isEdit ? "Edit Expense" : "Add Expense"}
        onBack={() => router.back()}
        actions={
          isEdit ? (
            <Stack.Toolbar.Button
              icon="trash"
              tintColor={getSecondaryHex("text-secondary-950", colorScheme)}
              accessibilityLabel="Delete expense"
              onPress={() => setDeleteOpen(true)}
            />
          ) : !isPro ? (
            <Stack.Toolbar.View>
              <DailyLimitBadge
                count={dailyCount}
                limit={PERSONAL_EXPENSE_LIMIT}
              />
            </Stack.Toolbar.View>
          ) : undefined
        }
        androidActions={
          isEdit ? (
            <Pressable
              className="pr-1"
              aria-label="Delete expense"
              onPress={() => setDeleteOpen(true)}
            >
              <Trash2
                size={22}
                color={getSecondaryHex("text-secondary-950", colorScheme)}
              />
            </Pressable>
          ) : !isPro ? (
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
            text={isEdit ? "Save" : recurrence ? "Save Recurring" : "Add Expense"}
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

            {/* Status — paid vs an upcoming/unpaid bill. Hidden while a
                recurrence is set: a series has no single status, and each
                materialized occurrence starts Paid. */}
            {!recurrence && (
              <FormControl size="md">
                <FormControlLabel>
                  <FormControlLabelText>Status</FormControlLabelText>
                </FormControlLabel>
                <SelectField
                  onPress={() => setStatusSheetOpen(true)}
                  leading={
                    <Icon
                      as={status === "paid" ? "check-circle" : "schedule"}
                      className="text-secondary-950"
                      size={22}
                    />
                  }
                >
                  <Text className="text-lg capitalize">{status}</Text>
                </SelectField>
              </FormControl>
            )}

            {/* Repeat — Pro-only, ADD mode only. A recurrence turns this into a
                server-side series (the same cron that posts group recurring
                expenses materializes it). Not offered in edit mode: an already
                posted occurrence is an independent one-off. */}
            {!isEdit && (
              <FormControl size="md">
                <FormControlLabel>
                  <FormControlLabelText>Repeat</FormControlLabelText>
                </FormControlLabel>
                <SelectField
                  onPress={handleOpenRecurrence}
                  leading={
                    <Icon
                      as="event-repeat"
                      className="text-secondary-950"
                      size={22}
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
                    This creates a recurring series — the first expense posts
                    now, the rest post automatically.
                  </Text>
                )}
              </FormControl>
            )}

            {/* Book — read-only whenever the book is fixed (added from a book
                screen, or editing an existing expense); changeable only on the
                unlocked entry from Home / Scan. */}
            {selectedBook && (
              <FormControl size="md">
                <FormControlLabel>
                  <FormControlLabelText>Book</FormControlLabelText>
                </FormControlLabel>
                {isLocked || isEdit ? (
                  <Box className="p-4 border border-background-200 rounded-lg">
                    <HStack className="items-center gap-x-3">
                      <AppAvatar
                        size="xs"
                        name={selectedBook.name}
                        uri={selectedBook.avatar || undefined}
                      />
                      <Text className="text-lg" numberOfLines={1}>
                        {selectedBook.name}
                      </Text>
                    </HStack>
                  </Box>
                ) : (
                  <SelectField
                    onPress={() => setBookPickerOpen(true)}
                    leading={
                      <AppAvatar
                        size="xs"
                        name={selectedBook.name}
                        uri={selectedBook.avatar || undefined}
                      />
                    }
                  >
                    <Text className="text-lg" numberOfLines={1}>
                      {selectedBook.name}
                    </Text>
                  </SelectField>
                )}
              </FormControl>
            )}

            <VStack className="gap-y-1 pb-4">
              <UploadImage
                title="Upload Proof of Payment (optional)"
                key={
                  proofOfPayment?.assets?.[0]?.uri ?? existingProofUrl ?? "none"
                }
                defaultUri={
                  proofOfPayment?.assets?.[0]?.uri ?? existingProofUrl
                }
                onSelect={setProofOfPayment}
              />
              <Text className="text-secondary-950 text-sm">
                Proof could be a photo of a receipt, a payment screenshot, or
                any document that shows the expense details.
              </Text>
            </VStack>
          </VStack>
        </ScrollView>
      </FormLayout>

      <BookPickerSheet
        isOpen={bookPickerOpen}
        onClose={() => setBookPickerOpen(false)}
        books={bookList}
        onSelect={handleChangeBook}
        title="Select Book"
      />

      <CategorySheet
        isOpen={categorySheetOpen}
        category={category}
        onClose={() => setCategorySheetOpen(false)}
        onSelect={setCategory}
      />

      <DatePickerModal
        isOpen={dateSheetOpen}
        onClose={() => setDateSheetOpen(false)}
        value={expenseDate}
        onChange={setExpenseDate}
      />

      <PersonalExpenseStatusSheet
        isOpen={statusSheetOpen}
        onClose={() => setStatusSheetOpen(false)}
        status={status}
        onSelect={setStatus}
      />

      <RecurrenceSheet
        isOpen={recurrenceSheetOpen}
        value={recurrence}
        onClose={() => setRecurrenceSheetOpen(false)}
        onDone={(value) => {
          setRecurrence(value);
          setRecurrenceSheetOpen(false);
        }}
      />

      <UpgradeSheet
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        description={upgradeDescription}
      />

      {/* Delete confirm (header-action triggered) — mirrors the group expense
          detail screen. */}
      <Modal
        isOpen={deleteOpen}
        onClose={() => !deleting && setDeleteOpen(false)}
      >
        <ModalContent>
          <ModalHeader>
            <Heading size="lg">Delete Expense</Heading>
          </ModalHeader>
          <ModalBody>
            <Text>
              This expense will be permanently removed. This cannot be undone.
            </Text>
          </ModalBody>
          <ModalFooter>
            <HStack className="gap-x-2">
              <FormButton
                variant="outline"
                text="Cancel"
                disabled={deleting}
                onPress={() => setDeleteOpen(false)}
              />
              <FormButton
                text="Delete"
                action="negative"
                loading={deleting}
                onPress={handleDelete}
              />
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Fragment>
  );
}
