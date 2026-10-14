import CategoryIcon from "@/components/CategoryIcon";
import {
  CURRENCY_SAME_AS,
  CurrencySelectionSheet
} from "@/components/CurrencySelection";
import FormButton from "@/components/FormButton";
import FormInput from "@/components/FormInput";
import LoadingWrapper from "@/components/LoadingWrapper";
import SelectField from "@/components/SelectField";
import UpgradeSheet from "@/components/UpgradeSheet";
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
import UploadAvatar from "@/components/UploadAvatar";
import CategorySheet, {
  groupCategoryMeta
} from "@/features/expense/components/CategorySheet";
import { normalizeEntryCurrency } from "@/features/group/utils/groupCurrency";
import useAppToast from "@/hooks/use-app-toast";
import FormLayout from "@/layouts/FormLayout";
import services from "@/services";
import states from "@/states";
import { GroupCategory } from "@/types/groups";
import { categories, currencies } from "@/utils/constants";
import { ImagePickerSuccessResult } from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Fragment, useMemo, useState } from "react";

export default function EditGroupScreen() {
  const { details: userDetails } = states.user();
  const isPro = userDetails?.plan === "pro";

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState({
    name: "",
    avatar: null as ImagePickerSuccessResult | null,
    category: GroupCategory.GENERAL as string,
    // The group's REPORTING currency; `defaultExpenseCurrency` is what Add
    // Expense prefills. CURRENCY_SAME_AS = follow the reporting one.
    currency: "PHP",
    defaultExpenseCurrency: CURRENCY_SAME_AS
  });
  const [formErrors, setFormErrors] = useState({
    name: ""
  }) as any;
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);
  const [entryCurrencySheetOpen, setEntryCurrencySheetOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [defaultAvatar, setDefaultAvatar] = useState<string | null>(null);

  const currencyLabel = useMemo(
    () => currencies.find((c) => c.value === values.currency)?.label,
    [values.currency]
  );

  const entryCurrencyLabel = useMemo(
    () =>
      values.defaultExpenseCurrency
        ? (currencies.find((c) => c.value === values.defaultExpenseCurrency)
            ?.label ?? values.defaultExpenseCurrency)
        : "Same as group currency",
    [values.defaultExpenseCurrency]
  );

  // Pro-only — free groups are pinned to PHP on both, so the field would be
  // inert. Mirrors the create form.
  const showEntryCurrency = isPro;

  // The sentinel is a UI value only; null is "follow the group currency" on the
  // wire. Normalizing against the currency being saved in the SAME write means
  // moving the group currency onto a pinned entry currency collapses the pin
  // rather than freezing a copy that then drifts.
  const defaultExpenseCurrency = normalizeEntryCurrency(
    values.defaultExpenseCurrency,
    values.currency
  );

  const params = useLocalSearchParams();
  const router = useRouter();
  const groupId = params.groupId as string | undefined;

  const toast = useAppToast();

  useFocusEffect(
    useMemo(
      () => () => {
        if (!groupId) {
          router.replace("/groups");
          return;
        }

        fetchGroupDetails(groupId as string);
      },
      [groupId]
    )
  );

  const fetchGroupDetails = async (id: string) => {
    setLoading(true);

    try {
      const response = await services.group.getGroupById(id);

      if (!response) return;

      setValues({
        name: response.name,
        avatar: null,
        category: response.category,
        currency: response.currency ?? "PHP",
        defaultExpenseCurrency:
          response.default_expense_currency ?? CURRENCY_SAME_AS
      });
      setDefaultAvatar(response.avatar || null);
    } catch (error) {
      console.error("Error fetching group details:", error);
      // Offline fallback: seed from the live groups list / detail so the group
      // can still be edited (and queued) without a connection.
      const state = states.group.getState();
      const fromState =
        state.details?.id === id
          ? state.details
          : state.list.find((g) => g.id === id);
      if (fromState) {
        setValues({
          name: fromState.name,
          avatar: null,
          category: fromState.category,
          // A group cached before the currency split shipped has neither field.
          currency: fromState.currency ?? "PHP",
          defaultExpenseCurrency:
            fromState.default_expense_currency ?? CURRENCY_SAME_AS
        });
        setDefaultAvatar(fromState.avatar || null);
      } else {
        toast({
          title: "Failed to Load Group",
          description:
            "An error occurred while loading the group details. Please try again.",
          type: "error"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setValues({
      name: "",
      avatar: null,
      category: GroupCategory.GENERAL,
      currency: "PHP",
      defaultExpenseCurrency: CURRENCY_SAME_AS
    });
  };

  const handleSubmit = async () => {
    // Category always has a value (defaults to General), so only name needs a
    // required check here.
    const nextErrors = {
      name: values.name.trim() ? "" : "Name is required"
    };
    setFormErrors(nextErrors);
    if (nextErrors.name) return;

    if (!groupId) return;

    setSubmitting(true);

    try {
      const response = await services.group.updateGroup(groupId, {
        name: values.name,
        category: values.category,
        currency: values.currency,
        default_expense_currency: defaultExpenseCurrency,
        avatar: values.avatar
      });

      if (!response) {
        throw new Error("Failed to update group");
      }

      toast({
        title: "Group Updated",
        description: "Your group has been successfully updated.",
        type: "success"
      });
      handleBack();
    } catch (error) {
      console.error("Error updating group:", error);
      toast({
        title: "Group Update Failed",
        description:
          "An error occurred while updating the group. Please try again.",
        type: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    handleReset();
    router.back();
  };

  return (
    <Fragment>
      <FormLayout
        title="Edit Group"
        onBack={handleBack}
        footer={[
          <FormButton
            className="flex-1"
            text="Save Changes"
            loading={submitting}
            // Stays enabled even with fields missing — tapping runs validation
            // and surfaces the errors rather than silently doing nothing.
            onPress={handleSubmit}
          />
        ]}
      >
        <ScrollView className="flex-1">
          <LoadingWrapper
            isLoading={loading}
            text="Loading group details..."
          >
            <VStack className="gap-y-6 p-4">
              <UploadAvatar
                defaultAvatar={defaultAvatar || undefined}
                onSelect={(result) => setValues({ ...values, avatar: result })}
              />

              <FormInput
                type="text"
                label="Name"
                placeholder="Enter group name (e.g. Japan 2026)"
                value={values.name}
                onChangeText={(text) => {
                  setValues({ ...values, name: text });
                  if (formErrors.name)
                    setFormErrors((prev: any) => ({ ...prev, name: "" }));
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
                    Totals, stats and balances convert to it, for every member.
                    Existing expenses keep the currency they were entered in.
                  </FormControlHelperText>
                </FormControlHelper>
              </FormControl>

              {/* What Add Expense prefills. Unlike the book equivalent this is
                  a shared setting — the admin picks it and every member's Add
                  Expense follows, which the helper text has to say outright. */}
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
                      {defaultExpenseCurrency
                        ? `New expenses start in ${defaultExpenseCurrency} for everyone, counted toward the group's ${values.currency} totals.`
                        : "New expenses start in the group currency."}
                    </FormControlHelperText>
                  </FormControlHelper>
                </FormControl>
              )}
            </VStack>
          </LoadingWrapper>
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
        title="Currency"
        currency={values.currency}
        onClose={() => setCurrencySheetOpen(false)}
        onCurrencyChange={(value) => setValues({ ...values, currency: value })}
      />

      <CurrencySelectionSheet
        isOpen={entryCurrencySheetOpen}
        title="New Expenses"
        currency={values.defaultExpenseCurrency}
        sameAs={{
          label: "Same as group currency",
          subtitle: currencyLabel ?? values.currency
        }}
        onClose={() => setEntryCurrencySheetOpen(false)}
        onCurrencyChange={(value) =>
          setValues({ ...values, defaultExpenseCurrency: value })
        }
      />

      <UpgradeSheet
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        description="Multi-currency groups are a Pro feature. Upgrade to track a trip's spending in any currency."
      />
    </Fragment>
  );
}
