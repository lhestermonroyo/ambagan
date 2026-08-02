import AmountInput from "@/components/AmountInput";
import CategoryIcon from "@/components/CategoryIcon";
import { CurrencySelectionSheet } from "@/components/CurrencySelection";
import FormButton from "@/components/FormButton";
import FormInput from "@/components/FormInput";
import SelectField from "@/components/SelectField";
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlHelper,
  FormControlHelperText,
  FormControlLabel,
  FormControlLabelText
} from "@/components/ui/form-control";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import UpgradeSheet from "@/components/UpgradeSheet";
import UploadAvatar from "@/components/UploadAvatar";
import CategorySheet, {
  groupCategoryMeta
} from "@/features/expense/components/CategorySheet";
import useAppToast from "@/hooks/use-app-toast";
import FormLayout from "@/layouts/FormLayout";
import services from "@/services";
import states from "@/states";
import { BookBudgetPeriod } from "@/types/books";
import { GroupCategory } from "@/types/groups";
import { categories, currencies } from "@/utils/constants";
import { BASE_CURRENCY } from "@/utils/fx";
import * as offlineQueue from "@/utils/offlineQueue";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { ImagePickerSuccessResult } from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import "react-native-get-random-values";
import { v4 as uuid } from "uuid";

const budgetPeriods: { value: BookBudgetPeriod; label: string }[] = [
  { value: "monthly", label: "Every month" },
  { value: "total", label: "Never (total)" }
];

export default function CreateBookScreen() {
  const params = useLocalSearchParams();
  const bookId = typeof params.bookId === "string" ? params.bookId : undefined;
  const isEdit = !!bookId;

  const { details: userDetails } = states.user();
  const isPro = userDetails?.plan === "pro";

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState({
    name: "",
    avatar: null as ImagePickerSuccessResult | null,
    defaultAvatar: undefined as string | undefined,
    category: GroupCategory.GENERAL as string,
    // Every book starts in the app's home currency. Pro users can change it
    // here; for free users the selection is locked, pinning them to PHP.
    currency: BASE_CURRENCY,
    // Budget is optional and free for everyone. Empty string = no budget set.
    budget: "",
    budgetPeriod: "monthly" as BookBudgetPeriod
  });
  const [formErrors, setFormErrors] = useState({ name: "", budget: "" });
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const router = useRouter();
  const toast = useAppToast();

  // Edit mode — hydrate the form from the existing book.
  useEffect(() => {
    if (!bookId) return;
    let active = true;
    services.book
      .getBookById(bookId)
      .then((book) => {
        if (!active) return;
        setValues((prev) => ({
          ...prev,
          name: book.name,
          defaultAvatar: book.avatar ?? undefined,
          category: book.category,
          currency: book.currency,
          budget: book.budget != null ? String(book.budget) : "",
          budgetPeriod: book.budget_period ?? "monthly"
        }));
      })
      .catch(() => {
        toast({
          title: "Error",
          description: "Couldn't load this book. Please try again.",
          type: "error"
        });
        router.back();
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [bookId]);

  const currencyMeta = useMemo(
    () => currencies.find((c) => c.value === values.currency),
    [values.currency]
  );
  const currencyLabel = currencyMeta?.label;

  // Blank = no budget (a valid choice). Anything typed has to be a positive
  // number — the DB enforces the same via personal_books_budget_positive_chk.
  const parsedBudget = values.budget.trim() ? parseFloat(values.budget) : null;

  const handleSubmit = async () => {
    const nextErrors = {
      name: values.name.trim() ? "" : "Name is required",
      budget:
        parsedBudget !== null && (isNaN(parsedBudget) || parsedBudget <= 0)
          ? "Enter a budget greater than 0, or leave it blank"
          : ""
    };
    setFormErrors(nextErrors);
    if (nextErrors.name || nextErrors.budget) return;

    if (!userDetails?.id) return;

    // Offline create → queue it (updateBook queues itself inside the service).
    // The cover photo is skipped (no image upload offline).
    if (!isEdit && !(await offlineQueue.isOnline())) {
      const clientId = uuid();
      const optimistic = offlineQueue.buildOptimisticBook({
        clientId,
        name: values.name,
        category: values.category,
        currency: values.currency,
        budget: parsedBudget,
        budgetPeriod: values.budgetPeriod,
        userId: userDetails.id
      });
      await offlineQueue.queueCreateBook(
        userDetails.id,
        {
          name: values.name,
          category: values.category,
          currency: values.currency,
          budget: parsedBudget,
          budget_period: values.budgetPeriod,
          avatar: null,
          user_id: userDetails.id
        },
        optimistic
      );
      toast({
        title: "Saved offline",
        description:
          "Your book will be created automatically when you're back online.",
        type: "info"
      });
      router.replace("/books");
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        await services.book.updateBook(bookId, {
          name: values.name,
          category: values.category,
          currency: values.currency,
          budget: parsedBudget,
          budget_period: values.budgetPeriod,
          avatar: values.avatar
        });
        toast({
          title: "Book updated",
          description: "Your changes have been saved.",
          type: "success"
        });
        router.back();
      } else {
        const response = await services.book.saveBook({
          name: values.name,
          category: values.category,
          currency: values.currency,
          budget: parsedBudget,
          budget_period: values.budgetPeriod,
          avatar: values.avatar,
          user_id: userDetails.id
        });
        toast({
          title: "Book created",
          description: "Book created successfully.",
          type: "success"
        });
        router.replace(`/books/${response.data.bookId}`);
      }
    } catch (error) {
      console.error("Error saving book:", error);
      toast({
        title: isEdit ? "Update Failed" : "Book Creation Failed",
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
        title={isEdit ? "Edit Book" : "Create Book"}
        onBack={() => router.back()}
        footer={[
          <FormButton
            className="flex-1"
            text={isEdit ? "Save" : "Create"}
            loading={submitting}
            disabled={loading}
            onPress={handleSubmit}
          />
        ]}
      >
        <ScrollView className="flex-1">
          <VStack className="gap-y-6 p-4">
            <UploadAvatar
              defaultAvatar={values.defaultAvatar}
              onSelect={(result) => setValues({ ...values, avatar: result })}
            />

            <FormInput
              type="text"
              label="Book Name"
              placeholder="Enter book name (e.g. Daily, Japan Trip)"
              value={values.name}
              onChangeText={(text) => {
                setValues({ ...values, name: text });
                if (formErrors.name)
                  setFormErrors((prev) => ({ ...prev, name: "" }));
              }}
              autoCapitalize="none"
              errorMessage={formErrors.name}
            />

            <FormControl size="md">
              <FormControlLabel>
                <FormControlLabelText>Category</FormControlLabelText>
              </FormControlLabel>
              <SelectField
                onPress={() => setCategorySheetOpen(true)}
                leading={
                  <CategoryIcon
                    icon={groupCategoryMeta(values.category).icon}
                  />
                }
              >
                <Text className="text-lg" numberOfLines={1}>
                  {groupCategoryMeta(values.category).label}
                </Text>
              </SelectField>
            </FormControl>

            <FormControl size="md">
              <FormControlLabel>
                <FormControlLabelText>Currency</FormControlLabelText>
              </FormControlLabel>
              <SelectField
                onPress={() =>
                  isPro ? setCurrencySheetOpen(true) : setUpgradeOpen(true)
                }
              >
                <Text className="text-lg" numberOfLines={1}>
                  {isPro ? currencyLabel : `${currencyLabel} - Pro`}
                </Text>
              </SelectField>
              <FormControlHelper>
                <FormControlHelperText>
                  New expenses in this book default to this currency. You can
                  still change it per expense.
                </FormControlHelperText>
              </FormControlHelper>
            </FormControl>

            {/* Optional spending cap. Free for everyone — no Pro gate. */}
            <FormControl size="md" isInvalid={!!formErrors.budget}>
              <FormControlLabel>
                <FormControlLabelText>Budget (optional)</FormControlLabelText>
              </FormControlLabel>
              <AmountInput
                placeholder="0.00"
                leftAddon={currencyMeta?.sign ?? values.currency}
                value={values.budget}
                onChangeText={(text) => {
                  setValues({ ...values, budget: text });
                  if (formErrors.budget)
                    setFormErrors((prev) => ({ ...prev, budget: "" }));
                }}
              />
              {formErrors.budget ? (
                <FormControlError>
                  <FormControlErrorText>
                    {formErrors.budget}
                  </FormControlErrorText>
                </FormControlError>
              ) : (
                <FormControlHelper>
                  <FormControlHelperText>
                    Expenses in other currencies count too, converted to{" "}
                    {values.currency} at an approximate rate. Leave blank for no
                    budget.
                  </FormControlHelperText>
                </FormControlHelper>
              )}
            </FormControl>

            {/* Period only matters once a budget is actually set. */}
            {parsedBudget !== null && (
              <FormControl size="md">
                <FormControlLabel>
                  <FormControlLabelText>Budget resets</FormControlLabelText>
                </FormControlLabel>
                <HStack className="gap-x-2">
                  {budgetPeriods.map((period) => (
                    <Pressable
                      key={period.value}
                      className={cn(
                        "flex-1 py-3 rounded-lg border items-center",
                        values.budgetPeriod === period.value
                          ? "border-primary-200 bg-primary-50"
                          : "border-background-200"
                      )}
                      onPress={() =>
                        setValues({ ...values, budgetPeriod: period.value })
                      }
                    >
                      <Text
                        bold={values.budgetPeriod === period.value}
                        className={cn(
                          values.budgetPeriod === period.value
                            ? "text-primary-400"
                            : ""
                        )}
                      >
                        {period.label}
                      </Text>
                    </Pressable>
                    // <FormButton
                    //   key={period.value}
                    //   size="sm"
                    //   variant={
                    //     values.budgetPeriod === period.value
                    //       ? "solid"
                    //       : "outline"
                    //   }
                    //   text={period.label}
                    //   onPress={() =>
                    //     setValues({ ...values, budgetPeriod: period.value })
                    //   }
                    // />
                  ))}
                </HStack>
                <FormControlHelper>
                  <FormControlHelperText>
                    {values.budgetPeriod === "monthly"
                      ? "Starts over on the 1st of each month — best for ongoing books like Daily or Groceries."
                      : "One cap for the whole book, never reset — best for a finite book like a trip."}
                  </FormControlHelperText>
                </FormControlHelper>
              </FormControl>
            )}
          </VStack>
        </ScrollView>
      </FormLayout>

      <CategorySheet
        isOpen={categorySheetOpen}
        category={values.category}
        onClose={() => setCategorySheetOpen(false)}
        onSelect={(value) => setValues({ ...values, category: value })}
        options={categories}
      />

      <CurrencySelectionSheet
        isOpen={currencySheetOpen}
        currency={values.currency}
        onClose={() => setCurrencySheetOpen(false)}
        onCurrencyChange={(value) => setValues({ ...values, currency: value })}
      />

      <UpgradeSheet
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        description="Multi-currency books are a Pro feature. Upgrade to track spending in any currency."
      />
    </Fragment>
  );
}
