import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import LoadingWrapper from "@/components/LoadingWrapper";
import UpgradeSheet from "@/components/UpgradeSheet";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import AddExpenseStep from "@/features/expense/components/AddExpenseStep";
import PayersContributionStep from "@/features/expense/components/PayersContributionStep";
import SplitExpenseStep from "@/features/expense/components/SplitExpenseStep";
import { generatePaymentSplits } from "@/features/expense/utils/split.util";
import useAppToast from "@/hooks/use-app-toast";
import FormLayout from "@/layouts/FormLayout";
import services from "@/services";
import states from "@/states";
import { Group, Member } from "@/types/groups";
import { splitTypes } from "@/utils/constants";
import * as offlineQueue from "@/utils/offlineQueue";
import { ImagePickerSuccessResult } from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";

type SplitTypeValue = (typeof splitTypes)[number]["value"];

export default function EditExpenseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const groupId = params.groupId as string;
  const expenseId = params.expenseId as string;

  const { details: userDetails, defaultCurrency } = states.user();
  const isPro = userDetails?.plan === "pro";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [blockReason, setBlockReason] = useState<
    "offline" | "settled" | "notfound" | null
  >(null);
  const [step, setStep] = useState(1);
  const [upgradeSheetOpen, setUpgradeSheetOpen] = useState(false);
  const [upgradeDescription, setUpgradeDescription] = useState<
    string | undefined
  >(undefined);

  const [values, setValues] = useState({
    currency: defaultCurrency,
    amount: "",
    description: "",
    expense_date: new Date(),
    proof_of_payment: null as ImagePickerSuccessResult | null,
    group: null as Group | null,
    split_type: splitTypes[0].value as SplitTypeValue
  });
  const [existingProofUrl, setExistingProofUrl] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState({
    amount: "",
    description: ""
  }) as any;
  const [members, setMembers] = useState<Member[]>([]);
  const [splits, setSplits] = useState<{
    [userId: string]: { amount: string; percentage: string };
  }>({});
  const [payers, setPayers] = useState<{
    [userId: string]: { amount: string };
  }>({});

  const toast = useAppToast();

  useFocusEffect(
    useMemo(
      () => () => {
        if (!groupId || !expenseId) {
          router.back();
          return;
        }
        init();
      },
      [groupId, expenseId]
    )
  );

  const init = async () => {
    setLoading(true);

    // Editing mutates server rows directly — it isn't supported offline.
    const online = await offlineQueue.isOnline();
    if (!online) {
      setBlockReason("offline");
      setLoading(false);
      return;
    }

    try {
      const [expense, payerList, memberSplitList, paymentList, rawMembers, group] =
        await Promise.all([
          services.expense.getExpenseById(expenseId),
          services.expense.getPayersByExpenseId(expenseId),
          services.expense.getMemberSplitsByExpenseId(expenseId),
          services.expense.getPaymentsByExpenseId(expenseId),
          services.member.getMembersByGroupId(groupId),
          services.group.getGroupById(groupId)
        ]);

      if (!expense || !group) {
        setBlockReason("notfound");
        setLoading(false);
        return;
      }

      // Block editing once any settlement has moved past "pending" — replacing
      // the splits would silently drop that progress.
      const hasProgress = paymentList.some((p) => p.status !== "pending");
      if (hasProgress) {
        setBlockReason("settled");
        setLoading(false);
        return;
      }

      const currentUserId = userDetails?.id;
      const sortedMembers = [...rawMembers].sort((a, b) =>
        a.id === currentUserId ? -1 : b.id === currentUserId ? 1 : 0
      );

      const seededSplits: {
        [userId: string]: { amount: string; percentage: string };
      } = {};
      const seededPayers: { [userId: string]: { amount: string } } = {};
      sortedMembers.forEach((member) => {
        seededSplits[member.id] = { amount: "", percentage: "" };
        seededPayers[member.id] = { amount: "" };
      });
      memberSplitList.forEach((split) => {
        seededSplits[split.member.id] = {
          amount: String(split.amount),
          percentage: String(split.percentage)
        };
      });
      payerList.forEach((payer) => {
        seededPayers[payer.payer.id] = { amount: String(payer.amount) };
      });

      setMembers(sortedMembers);
      setSplits(seededSplits);
      setPayers(seededPayers);
      setExistingProofUrl(expense.proof_of_payment ?? null);
      setValues({
        currency: expense.currency || "PHP",
        amount: String(expense.amount),
        description: expense.description,
        expense_date: new Date(expense.expense_date ?? expense.created_at),
        proof_of_payment: null,
        group: group as unknown as Group,
        split_type: (expense.split_type as SplitTypeValue) ?? splitTypes[0].value
      });
      setBlockReason(null);
    } catch (error) {
      console.log("Error loading expense for edit:", error);
      setBlockReason("notfound");
    } finally {
      setLoading(false);
    }
  };

  const handlePayerAmountChange = (userId: string, amount: string) => {
    setPayers((prev) => ({ ...prev, [userId]: { amount } }));
  };

  const handleSetSplits = (
    next: { [userId: string]: { amount: string; percentage: string } },
    tab: SplitTypeValue
  ) => {
    setValues((prev) => ({ ...prev, split_type: tab }));
    setSplits(next);
  };

  const handleSubmit = async () => {
    const errors: any = {};
    if (!values.amount) errors.amount = "Amount is required";
    if (!values.description) errors.description = "Description is required";
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    if (!values.group || !userDetails) return;

    const hasValidPayer = Object.values(payers).some(
      (payer) => parseFloat(payer.amount) > 0
    );
    if (!hasValidPayer) {
      toast({
        title: "Invalid Payer Amount",
        description: "At least one payer must have an amount greater than 0.",
        type: "error"
      });
      return;
    }

    const hasValidSplit = Object.values(splits).some(
      (split) =>
        parseFloat(split.amount) > 0 && parseFloat(split.percentage) > 0
    );
    if (!hasValidSplit) {
      toast({
        title: "Invalid Split",
        description:
          "At least one member split must have an amount and percentage greater than 0.",
        type: "error"
      });
      return;
    }

    const mappedSplits = Object.keys(splits)
      .filter(
        (userId) =>
          parseFloat(splits[userId].amount) > 0 &&
          parseFloat(splits[userId].percentage) > 0
      )
      .map((userId) => ({
        userId,
        amount: parseFloat(splits[userId].amount),
        percentage: parseFloat(splits[userId].percentage)
      }));
    const mappedPayers = Object.keys(payers)
      .filter((userId) => parseFloat(payers[userId].amount) > 0)
      .map((userId) => ({ userId, amount: parseFloat(payers[userId].amount) }));

    if (new Set([...mappedPayers, ...mappedSplits].map((m) => m.userId)).size < 2) {
      toast({
        title: "Invalid Expense",
        description:
          "An expense must involve at least two different members as payers or splits.",
        type: "error"
      });
      return;
    }

    const online = await offlineQueue.isOnline();
    if (!online) {
      toast({
        title: "You're offline",
        description: "Editing an expense requires an internet connection.",
        type: "error"
      });
      return;
    }

    const paymentSplits = generatePaymentSplits(mappedPayers, mappedSplits);
    if (paymentSplits.length === 0) {
      toast({
        title: "Invalid Expense",
        description:
          "Everyone paid their exact share. There's nothing to split or settle.",
        type: "error"
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await services.expense.updateExpense(
        expenseId,
        {
          amount: parseFloat(values.amount),
          description: values.description,
          proof_of_payment: values.proof_of_payment ?? existingProofUrl,
          group_id: values.group.id,
          split_type: values.split_type,
          currency: values.currency,
          expense_date: values.expense_date
        },
        mappedPayers,
        mappedSplits,
        paymentSplits
      );

      if (!response) {
        throw new Error("Failed to update expense");
      }

      toast({
        title: "Expense Updated",
        description: "Your changes have been saved.",
        type: "success"
      });
      router.back();
    } catch (error: any) {
      console.log("Error updating expense:", error);
      if (error?.message === services.expense.SETTLEMENT_IN_PROGRESS) {
        toast({
          title: "Can't Edit Expense",
          description:
            "A settlement is already in progress for this expense, so it can no longer be edited.",
          type: "error"
        });
      } else {
        toast({
          title: "Update Failed",
          description:
            "An error occurred while updating the expense. Please try again.",
          type: "error"
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isValidPayerContribution = useMemo(() => {
    const totalPayerAmount = Object.values(payers).reduce(
      (sum, payer) => sum + (parseFloat(payer.amount) || 0),
      0
    );
    return Math.abs(totalPayerAmount - parseFloat(values.amount)) < 0.01;
  }, [payers, values.amount]);

  const isMultipleMembers = useMemo(
    () =>
      new Set([
        ...Object.keys(payers).filter(
          (userId) => parseFloat(payers[userId].amount) > 0
        ),
        ...Object.keys(splits).filter(
          (userId) =>
            parseFloat(splits[userId].amount) > 0 &&
            parseFloat(splits[userId].percentage) > 0
        )
      ]).size >= 2,
    [payers, splits]
  );

  const isValidMemberSplit = useMemo(() => {
    const included = Object.keys(splits).filter(
      (userId) =>
        parseFloat(splits[userId].amount) > 0 &&
        parseFloat(splits[userId].percentage) > 0
    );
    const totalSplitAmount = included.reduce(
      (sum, userId) => sum + (parseFloat(splits[userId].amount) || 0),
      0
    );
    const totalPercentage = included.reduce(
      (sum, userId) => sum + (parseFloat(splits[userId].percentage) || 0),
      0
    );
    return (
      Math.abs(totalSplitAmount - parseFloat(values.amount)) < 0.01 &&
      Math.abs(totalPercentage - 100) < 0.01
    );
  }, [splits, values.amount]);

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

  return (
    <>
      <FormLayout
        title="Edit Expense"
        onBack={() => router.back()}
        footer={
          loading
            ? []
            : [
                step === 1 && (
                  <FormButton
                    key="step-1-next"
                    className="flex-1"
                    text="Continue"
                    disabled={!values.amount || !values.description}
                    onPress={() => setStep(2)}
                  />
                ),
                step === 2 && [
                  <FormButton
                    key="step-2-back"
                    className="flex-1"
                    variant="outline"
                    text="Back"
                    disabled={submitting}
                    onPress={() => setStep(1)}
                  />,
                  <FormButton
                    key="step-2-next"
                    className="flex-1"
                    text="Continue"
                    disabled={!isValidPayerContribution}
                    onPress={() => setStep(3)}
                  />
                ],
                step === 3 && [
                  <FormButton
                    key="step-3-back"
                    className="flex-1"
                    variant="outline"
                    text="Back"
                    disabled={submitting}
                    onPress={() => setStep(2)}
                  />,
                  <FormButton
                    key="step-3-submit"
                    className="flex-1"
                    text="Save Changes"
                    loading={submitting}
                    disabled={!isValidMemberSplit || !isMultipleMembers}
                    onPress={handleSubmit}
                  />
                ]
              ]
        }
      >
        <LoadingWrapper isLoading={loading} text="Loading expense...">
          {values.group && (
            <>
              <Box className={step === 1 ? "flex-1" : "hidden"}>
                <AddExpenseStep
                  values={values}
                  setValues={setValues}
                  formErrors={formErrors}
                  isLockedGroup
                  currencyLocked={!isPro}
                  proofDefaultUri={existingProofUrl}
                  onCurrencyLockedPress={() => {
                    setUpgradeDescription(
                      "Multi-currency expenses are a Pro feature. Upgrade to split bills in any currency."
                    );
                    setUpgradeSheetOpen(true);
                  }}
                  step={step}
                />
              </Box>
              <Box className={step === 2 ? "flex-1" : "hidden"}>
                <PayersContributionStep
                  payers={payers}
                  members={members}
                  onPayerAmountChange={handlePayerAmountChange}
                  amount={values.amount}
                  currency={values.currency}
                  step={step}
                  isLockedGroup
                  groupName={values.group.name}
                />
              </Box>
              <Box className={step === 3 ? "flex-1" : "hidden"}>
                <SplitExpenseStep
                  amount={values.amount}
                  currency={values.currency}
                  groupId={values.group.id}
                  members={members}
                  splits={splits}
                  onSetSplits={handleSetSplits}
                  step={step}
                  isLockedGroup
                  groupName={values.group.name}
                  initialTab={values.split_type}
                  skipInitialReset
                />
              </Box>
            </>
          )}
        </LoadingWrapper>
      </FormLayout>

      <UpgradeSheet
        isOpen={upgradeSheetOpen}
        onClose={() => setUpgradeSheetOpen(false)}
        description={upgradeDescription}
      />
    </>
  );
}
