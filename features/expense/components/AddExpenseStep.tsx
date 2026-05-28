import AmountInput from "@/components/AmountInput";
import CurrencySelection from "@/components/CurrencySelection";
import FormTextarea from "@/components/FormTextarea";
import ProBadge from "@/components/ProBadge";
import StepperProgress from "@/components/StepperProgress";
import { Box } from "@/components/ui/box";
import {
  FormControl,
  FormControlHelper,
  FormControlHelperText,
  FormControlLabel,
  FormControlLabelText
} from "@/components/ui/form-control";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import UploadImage from "@/components/UploadImage";
import { Group } from "@/types/groups";
import { getPrimaryHex } from "@/utils/getColorHex";
import DateTimePicker from "@react-native-community/datetimepicker";
import { ImagePickerSuccessResult } from "expo-image-picker";
import { useColorScheme } from "react-native";
import GroupSelection from "./GroupSelection";

type AddExpenseStepProps = {
  values: {
    currency: string;
    amount: string;
    description: string;
    expense_date: Date;
    proof_of_payment: ImagePickerSuccessResult | null;
    group: Group | null;
    split_type: string;
  };
  setValues: React.Dispatch<
    React.SetStateAction<{
      currency: string;
      amount: string;
      description: string;
      expense_date: Date;
      proof_of_payment: ImagePickerSuccessResult | null;
      group: Group | null;
      split_type: string;
    }>
  >;
  formErrors: {
    amount?: string;
    description?: string;
  };
  isLockedGroup?: boolean;
  isGroupPro?: boolean;
  step: number;
};

export default function AddExpenseStep({
  values,
  setValues,
  formErrors,
  isLockedGroup = false,
  isGroupPro = false,
  step = 1
}: AddExpenseStepProps) {
  const colorScheme = useColorScheme() ?? "light";
  return (
    <ScrollView className="flex-1" bounces={false}>
      <VStack className="px-4 gap-y-4">
        <StepperProgress currentStep={step} steps={3} />
        <VStack>
          <Text className="text-2xl" bold>
            Expense Details
          </Text>
          <Text className="text-secondary-950">
            Fill-in your expense details.
          </Text>
        </VStack>
      </VStack>
      <VStack className="gap-y-6 p-4">
        <FormControl size="md">
          <FormControlLabel>
            <HStack className="items-center gap-x-2">
              <FormControlLabelText>Amount</FormControlLabelText>
            </HStack>
          </FormControlLabel>
          <HStack className="gap-x-2 items-end h-12">
            {isGroupPro ? (
              <CurrencySelection
                currency={values.currency}
                onCurrencyChange={(currency) =>
                  setValues((prevValues) => ({ ...prevValues, currency }))
                }
              />
            ) : (
              <Box className="border border-secondary-500 bg-secondary-50 items-center justify-center h-full px-2 py-2 rounded-lg">
                <Text className="font-semibold text-secondary-950">
                  PHP (₱)
                </Text>
              </Box>
            )}
            <VStack className="flex-1">
              <AmountInput
                className="h-full"
                placeholder="0.00"
                value={values.amount}
                onChangeText={(text) => setValues({ ...values, amount: text })}
                errorMessage={formErrors.amount}
              />
            </VStack>
          </HStack>
          {!isGroupPro && (
            <FormControlHelper>
              <HStack className="items-center gap-x-1">
                <FormControlHelperText className="text-secondary-950 text-sm">
                  Multi-currency requires
                </FormControlHelperText>
                <ProBadge />
              </HStack>
            </FormControlHelper>
          )}
        </FormControl>

        <FormTextarea
          label="Description"
          placeholder="Enter description (e.g., Dinner at KFC Baguio)"
          value={values.description}
          onChangeText={(text) => setValues({ ...values, description: text })}
          autoCapitalize="none"
          errorMessage={formErrors.description}
          size="sm"
        />

        <FormControl size="md">
          <HStack className="items-center justify-between">
            <FormControlLabel className="flex-1">
              <FormControlLabelText>Expense Date</FormControlLabelText>
            </FormControlLabel>
            <DateTimePicker
              accentColor={getPrimaryHex("text-primary-400", colorScheme)}
              value={values.expense_date}
              onChange={(_, date) => {
                if (date) {
                  setValues((prevValues) => ({
                    ...prevValues,
                    expense_date: date
                  }));
                }
              }}
            />
          </HStack>
        </FormControl>

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
              <FormControlHelperText className="text-secondary-950 text-sm">
                Latest joined or created group will be selected by default. You
                can change group by tapping the group card.
              </FormControlHelperText>
            </FormControlHelper>
          )}
        </FormControl>

        <VStack className="gap-y-1">
          <UploadImage
            title="Upload Proof of Payment"
            onSelect={(result) =>
              setValues({ ...values, proof_of_payment: result })
            }
          />
          <Text className="text-secondary-950 text-sm">
            Proof could be a photo of receipt, screenshot of online payment, or
            any document that shows the expense details.
          </Text>
        </VStack>

      </VStack>
    </ScrollView>
  );
}
