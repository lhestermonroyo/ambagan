import AppAvatar from "@/components/AppAvatar";
import CategoryIcon from "@/components/CategoryIcon";
import {
  CURRENCY_SAME_AS,
  CurrencySelectionSheet
} from "@/components/CurrencySelection";
import FormButton from "@/components/FormButton";
import FormInput from "@/components/FormInput";
import MoreOptions from "@/components/MoreOptions";
import SelectField from "@/components/SelectField";
import {
  FormControl,
  FormControlHelper,
  FormControlHelperText,
  FormControlLabel,
  FormControlLabelText
} from "@/components/ui/form-control";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import UpgradeSheet from "@/components/UpgradeSheet";
import UploadAvatar from "@/components/UploadAvatar";
import LinkedGroupSheet from "@/features/book/components/LinkedGroupSheet";
import CategorySheet, {
  groupCategoryMeta
} from "@/features/expense/components/CategorySheet";
import useAppToast from "@/hooks/use-app-toast";
import FormLayout from "@/layouts/FormLayout";
import services from "@/services";
import states from "@/states";
import { Group, GroupCategory } from "@/types/groups";
import { categories, currencies } from "@/utils/constants";
import { BASE_CURRENCY } from "@/utils/fx";
import * as offlineQueue from "@/utils/offlineQueue";
import { ImagePickerSuccessResult } from "expo-image-picker";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import "react-native-get-random-values";
import { v4 as uuid } from "uuid";

export default function CreateBookScreen() {
  const params = useLocalSearchParams<{ bookId?: string }>();
  return typeof params.bookId === "string" && params.bookId
    ? <EditIndividualScreen />
    : <Redirect href={{ pathname: "/groups/create", params: { mode: "individual" } }} />;
}

function EditIndividualScreen() {
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
    // The entry's reporting currency — totals, stats, roll-up. Every entry starts
    // in the app's home currency. Pro users can change it here; for free users
    // the selection is locked, pinning them to PHP.
    currency: BASE_CURRENCY,
    // What Add Expense prefills, kept separate so a trip can be reported in PHP
    // and entered in JPY. CURRENCY_SAME_AS (the default) = follow `currency`,
    // and is stored as null so a later currency edit carries over.
    defaultExpenseCurrency: CURRENCY_SAME_AS,
    // Optional roll-up link to a group. Free for everyone — no Pro gate.
    groupId: null as string | null
  });
  const [formErrors, setFormErrors] = useState({ name: "" });
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);
  const [entryCurrencySheetOpen, setEntryCurrencySheetOpen] = useState(false);
  const [groupSheetOpen, setGroupSheetOpen] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  // Entry currency / linked group collapse behind "More options" — all of
  // them optional with a working default, so creating starts closed on just the
  // name. Editing opens the section when the loaded book has actually set one of
  // them (see the hydrate effect), since collapsed it would hide a setting the
  // user chose and read as though the book had lost it.
  const [optionsExpanded, setOptionsExpanded] = useState(false);

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
          defaultExpenseCurrency:
            book.default_expense_currency ?? CURRENCY_SAME_AS,
          groupId: book.group_id
        }));
        // Expand saved optional settings when editing.
        if (
          book.group_id != null ||
          book.default_expense_currency != null
        ) {
          setOptionsExpanded(true);
        }
      })
      .catch(() => {
        toast({
          title: "Error",
          description: "Couldn't load this Individual entry. Please try again.",
          type: "error"
        });
        router.back();
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [bookId]);

  // The user's groups, for the linked-group picker. Fetched here rather than read
  // from the groups state so the field works on a cold start straight into the
  // book form (deep link, or a user who never opened the Groups tab).
  useEffect(() => {
    if (!userDetails?.id) return;
    let active = true;
    services.group
      .getGroupsByUserId(userDetails.id)
      .then((data: Group[]) => active && setGroups(data))
      .catch(() => active && setGroups([]));
    return () => {
      active = false;
    };
  }, [userDetails?.id]);

  const linkedGroup = useMemo(
    () => groups.find((g) => g.id === values.groupId) ?? null,
    [groups, values.groupId]
  );

  const currencyMeta = useMemo(
    () => currencies.find((c) => c.value === values.currency),
    [values.currency]
  );
  const currencyLabel = currencyMeta?.label;

  const entryCurrencyLabel = useMemo(
    () =>
      values.defaultExpenseCurrency
        ? (currencies.find((c) => c.value === values.defaultExpenseCurrency)
            ?.label ?? values.defaultExpenseCurrency)
        : "Same as Individual entry currency",
    [values.defaultExpenseCurrency]
  );

  // The entry-currency field only earns its place once the two can actually
  // differ — which needs Pro (free users are pinned to PHP on both). Shown to
  // any Pro user rather than only after the book currency moves off PHP, so a
  // PHP-reported trip abroad — the whole point of the field — is reachable
  // without first having to change something else.
  const showEntryCurrency = isPro;

  const handleSubmit = async () => {
    const nextErrors = { name: values.name.trim() ? "" : "Name is required" };
    setFormErrors(nextErrors);
    if (nextErrors.name) return;

    if (!userDetails?.id) return;

    // The sentinel is a UI value only — null is what "follow the book currency"
    // is on the wire. Normalized once here so every branch below agrees.
    const defaultExpenseCurrency = values.defaultExpenseCurrency || null;

    // Offline create → queue it (updateBook queues itself inside the service).
    // The cover photo is skipped (no image upload offline).
    if (!isEdit && !(await offlineQueue.isOnline())) {
      const clientId = uuid();
      const optimistic = offlineQueue.buildOptimisticBook({
        clientId,
        name: values.name,
        category: values.category,
        currency: values.currency,
        defaultExpenseCurrency: defaultExpenseCurrency,
        budget: null,
        budgetPeriod: "monthly",
        groupId: values.groupId,
        userId: userDetails.id
      });
      await offlineQueue.queueCreateBook(
        userDetails.id,
        {
          name: values.name,
          category: values.category,
          currency: values.currency,
          default_expense_currency: defaultExpenseCurrency,
          budget: null,
          budget_period: "monthly",
          group_id: values.groupId,
          avatar: null,
          user_id: userDetails.id
        },
        optimistic
      );
      toast({
        title: "Saved offline",
        description:
          "Your Individual entry will be created automatically when you're back online.",
        type: "info"
      });
      router.replace("/groups");
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        await services.book.updateBook(bookId, {
          name: values.name,
          category: values.category,
          currency: values.currency,
          default_expense_currency: defaultExpenseCurrency,
          group_id: values.groupId,
          avatar: values.avatar
        });
        toast({
          title: "Individual updated",
          description: "Your changes have been saved.",
          type: "success"
        });
        router.back();
      } else {
        const response = await services.book.saveBook({
          name: values.name,
          category: values.category,
          currency: values.currency,
          default_expense_currency: defaultExpenseCurrency,
          budget: null,
          budget_period: "monthly",
          group_id: values.groupId,
          avatar: values.avatar,
          user_id: userDetails.id
        });
        toast({
          title: "Individual created",
          description: "Individual created successfully.",
          type: "success"
        });
        router.replace(`/books/${response.data.bookId}`);
      }
    } catch (error) {
      console.error("Error saving Individual entry:", error);
      // The group-link failures (already linked / not a member) carry a message
      // the user can actually act on, so don't bury them under the generic copy.
      const message =
        error instanceof Error &&
        (error.message === services.book.LINKED_GROUP_CONFLICT_MESSAGE ||
          error.message === services.book.NOT_GROUP_MEMBER_MESSAGE)
          ? error.message
          : "An error occurred. Please try again.";
      toast({
        title: isEdit ? "Update Failed" : "Individual Creation Failed",
        description: message,
        type: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Fragment>
      <FormLayout
        title={isEdit ? "Edit Individual" : "Create Individual"}
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
              label="Name"
              placeholder="Enter name (e.g. Daily, Japan Trip)"
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

            {/* The book's REPORTING currency. Stays out of "More options" with
                the name and category: it's what every figure on the book is
                denominated in, so it's part of what the book IS rather than a
                setting on it — and it's the field a traveler starting a trip
                book reaches for first. */}
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
                  Totals and stats convert to it.
                </FormControlHelperText>
              </FormControlHelper>
            </FormControl>

            {/* Optional entry currency and shared-group roll-up settings. */}
            <MoreOptions
              expanded={optionsExpanded}
              onToggle={() => setOptionsExpanded((prev) => !prev)}
            >
              {/* What Add Expense prefills — separate from the book currency so
                  a trip can be reported in the currency you think in and entered
                  in the one you're actually spending. Pro-only, since free books
                  are pinned to PHP on both counts and the field would be inert. */}
              {showEntryCurrency && (
                <FormControl size="md">
                  <FormControlLabel>
                    <FormControlLabelText>
                      Default for new expenses
                    </FormControlLabelText>
                  </FormControlLabel>
                  <SelectField onPress={() => setEntryCurrencySheetOpen(true)}>
                    <Text className="text-lg" numberOfLines={1}>
                      {entryCurrencyLabel}
                    </Text>
                  </SelectField>
                  <FormControlHelper>
                    <FormControlHelperText>
                      {values.defaultExpenseCurrency
                        ? `New expenses start in ${values.defaultExpenseCurrency}, counted toward your ${values.currency} totals.`
                        : "New expenses start in the Individual entry currency."}
                    </FormControlHelperText>
                  </FormControlHelper>
                </FormControl>
              )}

              {/* Optional roll-up link to a group. Free for everyone — no Pro
                  gate: it's the main reason a group-only user ever starts a book. */}
              <FormControl size="md">
                <FormControlLabel>
                  <FormControlLabelText>
                    Linked group (optional)
                  </FormControlLabelText>
                </FormControlLabel>
                <SelectField
                  onPress={() => setGroupSheetOpen(true)}
                  leading={
                    linkedGroup ? (
                      <AppAvatar
                        size="xs"
                        name={linkedGroup.name}
                        uri={linkedGroup.avatar || ""}
                      />
                    ) : undefined
                  }
                >
                  <Text className="text-lg" numberOfLines={1}>
                    {linkedGroup?.name ?? "Not linked"}
                  </Text>
                </SelectField>
                <FormControlHelper>
                  <FormControlHelperText>
                    Adds your share of the group&apos;s expenses to this
                    Individual entry&apos;s total. Your personal expenses stay private.
                  </FormControlHelperText>
                </FormControlHelper>
              </FormControl>
            </MoreOptions>
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
        title="Individual Currency"
        onClose={() => setCurrencySheetOpen(false)}
        onCurrencyChange={(value) => setValues({ ...values, currency: value })}
      />

      <CurrencySelectionSheet
        isOpen={entryCurrencySheetOpen}
        currency={values.defaultExpenseCurrency}
        title="Default For New Expenses"
        sameAs={{
          label: "Same as Individual entry currency",
          subtitle: currencyLabel ?? values.currency
        }}
        onClose={() => setEntryCurrencySheetOpen(false)}
        onCurrencyChange={(value) =>
          setValues({ ...values, defaultExpenseCurrency: value })
        }
      />

      <LinkedGroupSheet
        isOpen={groupSheetOpen}
        onClose={() => setGroupSheetOpen(false)}
        groups={groups}
        selectedGroupId={values.groupId}
        onSelect={(groupId) => setValues({ ...values, groupId })}
      />

      <UpgradeSheet
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        description="Multi-currency Individual entries are a Pro feature. Upgrade to track spending in any currency."
      />
    </Fragment>
  );
}
