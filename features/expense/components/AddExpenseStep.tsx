import AmountInput from "@/components/AmountInput";
import CurrencySelection from "@/components/CurrencySelection";
import FormTextarea from "@/components/FormTextarea";
import Icon from "@/components/Icon";
import PressableListItem from "@/components/PressableListItem";
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
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView
} from "@gorhom/bottom-sheet";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import { ImagePickerSuccessResult } from "expo-image-picker";
import { CalendarDays } from "lucide-react-native";
import { useCallback, useRef } from "react";
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
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";
  const dateSheetRef = useRef<BottomSheetModal>(null);
  const openDateSheet = useCallback(() => dateSheetRef.current?.present(), []);
  const closeDateSheet = useCallback(() => dateSheetRef.current?.dismiss(), []);

  return (
    <>
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
                  onChangeText={(text) =>
                    setValues({ ...values, amount: text })
                  }
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
            <FormControlLabel>
              <FormControlLabelText>Expense Date</FormControlLabelText>
            </FormControlLabel>
            <PressableListItem
              onPress={openDateSheet}
              className="p-4 border border-background-200 rounded-lg"
            >
              <HStack className="items-center flex-1 gap-x-2">
                <CalendarDays
                  color={getSecondaryHex("text-secondary-950", colorScheme)}
                />
                <Text className="flex-1 text-lg">
                  {format(values.expense_date, "MMMM dd, yyyy")}
                </Text>
                <Icon as="unfold-more" className="text-secondary-950" />
              </HStack>
            </PressableListItem>
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
                  Latest joined or created group will be selected by default.
                  You can change group by tapping the group card.
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
              Proof could be a photo of receipt, screenshot of online payment,
              or any document that shows the expense details.
            </Text>
          </VStack>
        </VStack>
      </ScrollView>

      <BottomSheetModal
        ref={dateSheetRef}
        snapPoints={["60%"]}
        backdropComponent={(props) => (
          <BottomSheetBackdrop
            {...props}
            appearsOnIndex={0}
            disappearsOnIndex={-1}
          />
        )}
      >
        <BottomSheetView>
          <VStack className="gap-y-2 items-center">
            <VStack className="self-start px-4">
              <Text bold className="text-xl">
                Push Notifications
              </Text>
            </VStack>
            <VStack className="pb-4">
              <DateTimePicker
                value={values.expense_date}
                mode="date"
                display="inline"
                accentColor={getPrimaryHex("text-primary-400", colorScheme)}
                onChange={(_, date) => {
                  if (date) {
                    setValues((prev) => ({ ...prev, expense_date: date }));
                    closeDateSheet();
                  }
                }}
              />
            </VStack>
          </VStack>
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );
}
