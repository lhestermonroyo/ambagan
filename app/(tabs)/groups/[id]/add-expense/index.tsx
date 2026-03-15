import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import AddExpenseStep from "@/features/transaction/components/AddExpenseStep";
import SplitExpenseStep from "@/features/transaction/components/SplitExpenseStep";
import useAppToast from "@/hooks/use-app-toast";
import FormLayout from "@/layouts/FormLayout";
import services from "@/services";
import states from "@/states";
import { Group, Member } from "@/types/groups";
import { ImagePickerSuccessResult } from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";

export default function AddExpenseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const groupId = params.id as string | undefined;
  const isQuick = groupId === "[id]";

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState({
    amount: "",
    description: "",
    receipt: null as ImagePickerSuccessResult | null,
    group: null as Group | null,
    payer: null as Member | null
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
      isIncluded: boolean;
    };
  }>({});

  const group = states.group.getState();
  const user = states.user.getState();

  const showToast = useAppToast();

  useFocusEffect(
    useMemo(
      () => () => {
        if (group.groups.length) {
          let selectedGroup = group.groups[0];

          if (groupId) {
            const found = group.groups.find((g) => g.id === groupId);
            if (found) selectedGroup = found;
          }
          setValues((prevValues) => ({
            ...prevValues,
            group: selectedGroup
          }));
          fetchGroupMembers(selectedGroup.id);
        }
      },
      [group.groups.length, groupId]
    )
  );

  useEffect(() => {
    if (values.group) {
      fetchGroupMembers(values.group.id);
    }
  }, [values.group]);

  const fetchGroupMembers = async (groupId: string) => {
    try {
      const members = await services.member.getMembersByGroupId(groupId);

      if (!members) return;

      const includedMembers = members.map((member) => ({
        ...member,
        isIncluded: true
      }));

      const payer = includedMembers.find(
        (member) => member.id === user.details?.id
      );

      if (!payer) {
        throw new Error("Current user is not a member of the group");
      }

      setValues((prevValues) => ({ ...prevValues, payer }));

      setMembers(includedMembers);
    } catch (error) {
      console.error("Error fetching group members:", error);
    }
  };

  const handleReset = () => {
    setStep(1);
    setValues((prev) => ({
      ...prev,
      amount: "",
      description: "",
      receipt: null,
      payer: null
    }));
    setFormErrors({
      amount: "",
      description: ""
    });
    setMembers([]);
    setSplits({});
  };

  const handleSubmit = async () => {
    let errors: any = {};

    if (!values.amount) {
      errors.amount = "Amount is required";
    }

    if (!values.description) {
      errors.description = "Description is required";
    }

    if (values.group) {
      if (!values.payer) {
        errors.payer = "Payer is required";
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    if (Object.keys(splits).length < 2) {
      showToast(
        "Invalid Split",
        "Please include at least 2 members or more to split the expense.",
        "error"
      );
      return;
    }

    setSubmitting(true);

    try {
      const expensePayload = {
        amount: parseFloat(values.amount),
        description: values.description,
        receipt: values.receipt,
        groupId: values.group!.id,
        payerId: values.payer!.id
      };
      const mappedSplits = Object.keys(splits).map((userId) => ({
        userId,
        amount: parseFloat(splits[userId].amount),
        percentage: parseFloat(splits[userId].percentage)
      }));

      const response = await services.transaction.createExpense(
        expensePayload,
        mappedSplits
      );

      if (!response) {
        throw new Error("Failed to create expense");
      }

      showToast(
        "Expense Created",
        "Your expense has been created successfully.",
        "success"
      );
      handleBack();
    } catch (error) {
      console.log("Error", error);
      showToast(
        "Expense Creation Failed",
        "An error occurred while creating the expense. Please try again.",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    handleReset();

    if (!isQuick && groupId) {
      router.push(`/groups/${groupId || ""}`);
    } else {
      router.push("/home");
    }
  };

  const isValidSplit = useMemo(() => {
    const totalSplitAmount = Object.values(splits).reduce(
      (sum, split) => sum + (parseFloat(split.amount) || 0),
      0
    );
    const totalPercentage = Object.values(splits).reduce(
      (sum, split) => sum + (parseFloat(split.percentage) || 0),
      0
    );

    return (
      Math.abs(totalSplitAmount - parseFloat(values.amount)) < 0.01 &&
      Math.abs(totalPercentage - 100) < 0.01
    );
  }, [splits, values.amount]);
  const isMultipleMembers = useMemo(
    () =>
      Object.keys(splits).filter((key) => splits[key].isIncluded).length > 1,
    [splits]
  );

  if (!values.group) {
    return (
      <FormLayout title="Add Expense" onBack={handleBack} footer={[]}>
        <VStack className="flex-1 p-4">
          <VStack className="items-center justify-center flex-1 gap-y-4">
            <Icon
              as="sentiment-dissatisfied"
              size={64}
              className="text-primary-500"
            />
            <Text className="text-xl text-center">
              You are not part of any group yet. Please join or create a group
              to add an expense.
            </Text>
            <FormButton
              text="Create Group"
              iconEnd={
                <Icon as="chevron-right" className="text-background-0" />
              }
              onPress={() => router.push("/groups")}
            />
          </VStack>
        </VStack>
      </FormLayout>
    );
  }

  if (step === 1) {
    return (
      <FormLayout
        title={isQuick ? "Quick Expense" : "Add Expense"}
        onBack={handleBack}
        footer={[
          <FormButton
            className="flex-1"
            variant="outline"
            text="Cancel"
            onPress={() => {
              handleBack();
              handleReset();
            }}
          />,
          <FormButton
            className="flex-1"
            text="Continue"
            disabled={
              !values.amount ||
              !values.description ||
              !values.group ||
              !values.payer
            }
            onPress={() => setStep(2)}
          />
        ]}
      >
        <AddExpenseStep
          values={values}
          setValues={setValues}
          formErrors={formErrors}
          members={members}
          isLockedGroup={!isQuick}
        />
      </FormLayout>
    );
  }

  return (
    <FormLayout
      title="Split Expense"
      onBack={() => setStep(1)}
      footer={[
        <FormButton
          className="flex-1"
          variant="outline"
          text="Back"
          disabled={submitting}
          onPress={() => setStep(1)}
        />,
        <FormButton
          className="flex-1"
          text="Save Expense"
          loading={submitting}
          disabled={!isValidSplit || !isMultipleMembers}
          onPress={handleSubmit}
        />
      ]}
    >
      <SplitExpenseStep
        values={values}
        groupId={values.group.id}
        members={members}
        splits={splits}
        setSplits={setSplits}
      />
    </FormLayout>
  );
}
