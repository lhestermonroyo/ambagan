import CategoryIcon from "@/components/CategoryIcon";
import { CurrencySelectionSheet } from "@/components/CurrencySelection";
import FormButton from "@/components/FormButton";
import FormInput from "@/components/FormInput";
import SelectField from "@/components/SelectField";
import { Text } from "@/components/ui/text";
import {
  FormControl,
  FormControlHelper,
  FormControlHelperText,
  FormControlLabel,
  FormControlLabelText
} from "@/components/ui/form-control";
import { ScrollView } from "@/components/ui/scroll-view";
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
import { GroupCategory } from "@/types/groups";
import { categories, currencies } from "@/utils/constants";
import * as offlineQueue from "@/utils/offlineQueue";
import { ImagePickerSuccessResult } from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import "react-native-get-random-values";
import { v4 as uuid } from "uuid";

export default function CreateBookScreen() {
  const params = useLocalSearchParams();
  const bookId = typeof params.bookId === "string" ? params.bookId : undefined;
  const isEdit = !!bookId;

  const { details: userDetails, defaultCurrency } = states.user();
  const isPro = userDetails?.plan === "pro";

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState({
    name: "",
    avatar: null as ImagePickerSuccessResult | null,
    defaultAvatar: undefined as string | undefined,
    category: GroupCategory.GENERAL as string,
    // Free users are pinned to PHP; Pro users default to their preferred currency.
    currency: isPro ? defaultCurrency : "PHP"
  });
  const [formErrors, setFormErrors] = useState({ name: "" });
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
          currency: book.currency
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

  const currencyLabel = useMemo(
    () => currencies.find((c) => c.value === values.currency)?.label,
    [values.currency]
  );

  const handleSubmit = async () => {
    const nextErrors = {
      name: values.name.trim() ? "" : "Name is required"
    };
    setFormErrors(nextErrors);
    if (nextErrors.name) return;

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
        userId: userDetails.id
      });
      await offlineQueue.queueCreateBook(
        userDetails.id,
        {
          name: values.name,
          category: values.category,
          currency: values.currency,
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
                  <CategoryIcon icon={groupCategoryMeta(values.category).icon} />
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
