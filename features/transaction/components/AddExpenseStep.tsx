import AmountInput from "@/components/AmountInput";
import FormTextarea from "@/components/FormTextarea";
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
import UploadImage from "@/components/UploadImage";
import { Group, Member } from "@/types/groups";
import { ImagePickerSuccessResult } from "expo-image-picker";
import GroupSelection from "./GroupSelection";
import PayerSelection from "./PayerSelection";

type AddExpenseStepProps = {
  values: {
    amount: string;
    description: string;
    receipt: ImagePickerSuccessResult | null;
    group: Group | null;
    payer: Member | null;
  };
  members: Member[];
  setValues: React.Dispatch<
    React.SetStateAction<{
      amount: string;
      description: string;
      receipt: ImagePickerSuccessResult | null;
      group: Group | null;
      payer: Member | null;
    }>
  >;
  formErrors: {
    amount?: string;
    description?: string;
  };
  isLockedGroup?: boolean;
};

export default function AddExpenseStep({
  members,
  values,
  setValues,
  formErrors,
  isLockedGroup = false
}: AddExpenseStepProps) {
  return (
    <ScrollView>
      <VStack className="gap-y-6 p-4">
        <AmountInput
          label="Amount to Split"
          placeholder="0.00"
          value={values.amount}
          onChangeText={(text) => setValues({ ...values, amount: text })}
          autoCapitalize="none"
          keyboardType="numeric"
          errorMessage={formErrors.amount}
        />

        <FormTextarea
          label="Description"
          placeholder="Enter description (e.g., Dinner at KFC Baguio)"
          value={values.description}
          onChangeText={(text) => setValues({ ...values, description: text })}
          autoCapitalize="none"
          errorMessage={formErrors.description}
        />

        <FormControl size="md">
          <FormControlLabel>
            <FormControlLabelText>Group</FormControlLabelText>
          </FormControlLabel>
          <GroupSelection
            group={values.group}
            onChangeGroup={(group) =>
              setValues((prevValues) => ({ ...prevValues, group }))
            }
            isLocked={isLockedGroup}
          />
          {!isLockedGroup && (
            <FormControlHelper>
              <FormControlHelperText className="text-secondary-950">
                Latest joined or created group will be selected by default. You
                can change group by tapping the group card.
              </FormControlHelperText>
            </FormControlHelper>
          )}
        </FormControl>

        {values.payer && (
          <FormControl size="md">
            <FormControlLabel>
              <FormControlLabelText>
                Payer (Who paid for this expense?)
              </FormControlLabelText>
            </FormControlLabel>

            <PayerSelection
              payer={values.payer}
              members={members}
              onChangePayer={(payer) =>
                setValues((prevValues) => ({ ...prevValues, payer }))
              }
            />
          </FormControl>
        )}

        <VStack className="gap-y-1">
          <UploadImage
            title="Upload Proof of Expense"
            onSelect={(result) => setValues({ ...values, receipt: result })}
          />
          <Text className="text-secondary-950">
            Proof could be a photo of receipt, screenshot of online payment, or
            any document that shows the expense details.
          </Text>
        </VStack>
      </VStack>
    </ScrollView>
  );
}
