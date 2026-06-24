import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import UpgradeSheet from "@/components/UpgradeSheet";
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
import { DAILY_EXPENSE_LIMIT, splitTypes } from "@/utils/constants";
import { ImagePickerSuccessResult } from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";

export default function NewExpenseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const groupId = params.groupId as string | undefined;
  const isLocked = groupId !== "[groupId]";

  const { list: groupList } = states.group();
  const { defaultCurrency, details: userDetails } = states.user();
  const isPro = userDetails?.plan === "pro";

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [upgradeSheetOpen, setUpgradeSheetOpen] = useState(false);
  const [values, setValues] = useState({
    currency: defaultCurrency,
    amount: "",
    description: "",
    expense_date: new Date(),
    proof_of_payment: null as ImagePickerSuccessResult | null,
    group: null as Group | null,
    split_type: splitTypes[0].value as (typeof splitTypes)[number]["value"]
  });
  const [formErrors, setFormErrors] = useState({
    amount: "",
    description: ""
  }) as any;
  const [members, setMembers] = useState<Member[]>([]);
  const [splits, setSplits] = useState<{
    [userId: string]: {
      amount: string;
      percentage: string;
    };
  }>({});
  const [payers, setPayers] = useState<{
    [userId: string]: {
      amount: string;
    };
  }>({});

  const toast = useAppToast();

  useFocusEffect(
    useMemo(
      () => () => {
        if (groupList.length) {
          let selectedGroup = groupList[0];

          if (groupId) {
            const found = groupList.find((g) => g.id === groupId);
            if (found) selectedGroup = found;
          }
          setValues((prevValues) => ({
            ...prevValues,
            group: selectedGroup
          }));
          fetchGroupMembers(selectedGroup.id);
        }
      },
      [groupList.length, groupId]
    )
  );

  useEffect(() => {
    if (values.group) {
      fetchGroupMembers(values.group.id);
    }
  }, [values.group?.id]);

  const fetchGroupMembers = async (groupId: string) => {
    try {
      const raw = await services.member.getMembersByGroupId(groupId);

      if (!raw) return;

      const currentUserId = states.user.getState().details?.id;
      const members = [...raw].sort((a, b) =>
        a.id === currentUserId ? -1 : b.id === currentUserId ? 1 : 0
      );

      setMembers(members);

      const initialSplits: any = {};
      const initialContributions: any = {};

      members.forEach((member) => {
        initialSplits[member.id] = { amount: "", percentage: "" };
        initialContributions[member.id] = { amount: "" };
      });

      setSplits(initialSplits);
      setPayers(initialContributions);
    } catch (error) {
      console.error("Error fetching group members:", error);
    }
  };

  const handlePayerAmountChange = (userId: string, amount: string) => {
    setPayers((prevPayers) => ({
      ...prevPayers,
      [userId]: { amount }
    }));
  };

  const handleSetSplits = (
    splits: {
      [userId: string]: {
        amount: string;
        percentage: string;
      };
    },
    tab: (typeof splitTypes)[number]["value"]
  ) => {
    setValues((prevValues) => ({
      ...prevValues,
      split_type: tab
    }));
    setSplits(splits);
  };

  const handleSubmit = async () => {
    let errors: any = {};

    if (!values.amount) {
      errors.amount = "Amount is required";
    }

    if (!values.description) {
      errors.description = "Description is required";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    if (!values.group) {
      toast({
        title: "Group Not Selected",
        description: "Please select a group for this expense.",
        type: "error"
      });
      return;
    }

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

    const payerIds = Object.keys(payers)
      .filter((userId) => parseFloat(payers[userId].amount) > 0)
      .map((userId) => userId);
    const splitUserIds = Object.keys(splits)
      .filter(
        (userId) =>
          parseFloat(splits[userId].amount) > 0 &&
          parseFloat(splits[userId].percentage) > 0
      )
      .map((userId) => userId);

    const uniqueUserIds = new Set([...payerIds, ...splitUserIds]);

    if (uniqueUserIds.size < 2) {
      toast({
        title: "Invalid Expense",
        description:
          "An expense must involve at least two different members as payers or splits.",
        type: "error"
      });
      return;
    }

    if (!isPro) {
      const count = await services.expense.getDailyExpenseCount(
        userDetails!.id
      );
      if (count >= DAILY_EXPENSE_LIMIT) {
        setUpgradeSheetOpen(true);
        return;
      }
    }

    setSubmitting(true);

    try {
      const expensePayload = {
        amount: parseFloat(values.amount),
        description: values.description,
        group_id: values.group.id,
        proof_of_payment: values.proof_of_payment,
        split_type: values.split_type,
        currency: values.currency,
        expense_date: values.expense_date
      };
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
        .map((userId) => ({
          userId,
          amount: parseFloat(payers[userId].amount)
        }));
      const paymentSplits = generatePaymentSplits(mappedPayers, mappedSplits);

      if (paymentSplits.length === 0) {
        toast({
          title: "Invalid Expense",
          description:
            "Everyone paid their exact share. There's nothing to split or settle.",
          type: "error"
        });
        setSubmitting(false);
        return;
      }

      const response = await services.expense.saveExpense(
        expensePayload,
        mappedPayers,
        mappedSplits,
        paymentSplits
      );

      if (!response) {
        throw new Error("Failed to create expense");
      }

      toast({
        title: "Expense Created",
        description: "Your expense has been created successfully.",
        type: "success"
      });
      router.back();
    } catch (error) {
      console.log("Error", error);
      toast({
        title: "Expense Creation Failed",
        description:
          "An error occurred while creating the expense. Please try again.",
        type: "error"
      });
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
        ...Object.keys(payers)
          .filter((userId) => parseFloat(payers[userId].amount) > 0)
          .map((userId) => userId),
        ...Object.keys(splits)
          .filter(
            (userId) =>
              parseFloat(splits[userId].amount) > 0 &&
              parseFloat(splits[userId].percentage) > 0
          )
          .map((userId) => userId)
      ]).size >= 2,
    [payers, splits]
  );


  const isValidMemberSplit = useMemo(() => {
    const totalSplitAmount = Object.keys(splits)
      .filter(
        (userId) =>
          parseFloat(splits[userId].amount) > 0 &&
          parseFloat(splits[userId].percentage) > 0
      )
      .reduce(
        (sum, userId) => sum + (parseFloat(splits[userId].amount) || 0),
        0
      );
    const totalPercentage = Object.keys(splits)
      .filter(
        (userId) =>
          parseFloat(splits[userId].amount) > 0 &&
          parseFloat(splits[userId].percentage) > 0
      )
      .reduce(
        (sum, userId) => sum + (parseFloat(splits[userId].percentage) || 0),
        0
      );

    return (
      Math.abs(totalSplitAmount - parseFloat(values.amount)) < 0.01 &&
      Math.abs(totalPercentage - 100) < 0.01
    );
  }, [splits, values.amount]);

  if (!values.group) {
    return (
      <FormLayout
        title="Custom Expense"
        onBack={() => router.back()}
        footer={[]}
      >
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
      </FormLayout>
    );
  }

  return (
    <>
    <FormLayout
      title="Custom Expense"
      onBack={() => router.back()}
      footer={[
        step === 1 && (
          <FormButton
            key="step-1-next"
            className="flex-1"
            text="Continue"
            disabled={!values.amount || !values.description || !values.group}
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
            text="Save Expense"
            loading={submitting}
            disabled={!isValidMemberSplit || !isMultipleMembers}
            onPress={handleSubmit}
          />
        ]
      ]}
    >
      {step === 1 && (
        <AddExpenseStep
          values={values}
          setValues={setValues}
          formErrors={formErrors}
          isLockedGroup={isLocked}
          step={step}
        />
      )}
      {step === 2 && (
        <PayersContributionStep
          payers={payers}
          members={members}
          onPayerAmountChange={handlePayerAmountChange}
          amount={values.amount}
          currency={values.currency}
          step={step}
          isLockedGroup={isLocked}
          groupName={values.group.name}
        />
      )}
      {step === 3 && (
        <SplitExpenseStep
          amount={values.amount}
          currency={values.currency}
          groupId={values.group.id}
          members={members}
          splits={splits}
          onSetSplits={handleSetSplits}
          step={step}
          isLockedGroup={isLocked}
          groupName={values.group.name}
        />
      )}
    </FormLayout>

    <UpgradeSheet
      isOpen={upgradeSheetOpen}
      onClose={() => setUpgradeSheetOpen(false)}
      description="You've reached your 5 expense limit for today. Upgrade to Pro for unlimited expenses."
    />
    </>
  );
}
