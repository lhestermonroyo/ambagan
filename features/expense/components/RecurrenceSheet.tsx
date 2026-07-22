import AppSheet from "@/components/AppSheet";
import FormButton from "@/components/FormButton";
import FormInput from "@/components/FormInput";
import Icon from "@/components/Icon";
import PressableListItem from "@/components/PressableListItem";
import { Box } from "@/components/ui/box";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import {
  RecurrenceConfig,
  RecurrenceEndType,
  RecurrenceFrequency,
} from "@/types/expenses";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import { CalendarDays } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Modal, useColorScheme } from "react-native";

type RecurrenceSheetProps = {
  isOpen: boolean;
  /** The committed config, or null when the expense is currently one-off. */
  value: RecurrenceConfig | null;
  onClose: () => void;
  /** Commit a recurrence (or null to turn recurrence off). */
  onDone: (value: RecurrenceConfig | null) => void;
};

const FREQUENCIES: { label: string; value: RecurrenceFrequency }[] = [
  { label: "Daily", value: RecurrenceFrequency.DAILY },
  { label: "Weekly", value: RecurrenceFrequency.WEEKLY },
  { label: "Monthly", value: RecurrenceFrequency.MONTHLY },
];

const END_TYPES: { label: string; value: RecurrenceEndType }[] = [
  { label: "Never", value: RecurrenceEndType.NEVER },
  { label: "On date", value: RecurrenceEndType.ON_DATE },
  { label: "After…", value: RecurrenceEndType.AFTER_COUNT },
];

const defaultConfig = (): RecurrenceConfig => ({
  frequency: RecurrenceFrequency.MONTHLY,
  repeat_interval: 1,
  start_date: new Date(),
  end_type: RecurrenceEndType.NEVER,
  end_date: null,
  occurrence_limit: null,
});

/**
 * Fullscreen sheet to configure an expense's recurrence: frequency + interval,
 * start date, and an end condition (never / on a date / after N times). Edits a
 * local draft and only commits on save. "Don't repeat" clears the recurrence,
 * turning the expense back into a normal one-off.
 */
export default function RecurrenceSheet({
  isOpen,
  value,
  onClose,
  onDone,
}: RecurrenceSheetProps) {
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";

  const [draft, setDraft] = useState<RecurrenceConfig>(
    value ?? defaultConfig(),
  );
  const [countText, setCountText] = useState(
    value?.occurrence_limit ? String(value.occurrence_limit) : "12",
  );
  const [startPickerOpen, setStartPickerOpen] = useState(false);
  const [endPickerOpen, setEndPickerOpen] = useState(false);
  const closePickers = () => {
    setStartPickerOpen(false);
    setEndPickerOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setDraft(value ?? defaultConfig());
    setCountText(
      value?.occurrence_limit ? String(value.occurrence_limit) : "12",
    );
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const interval = draft.repeat_interval;
  const parsedCount = parseInt(countText, 10) || 0;

  const valid =
    interval >= 1 &&
    (draft.end_type !== RecurrenceEndType.ON_DATE || !!draft.end_date) &&
    (draft.end_type !== RecurrenceEndType.AFTER_COUNT || parsedCount >= 1);

  const handleSave = () => {
    onDone({
      ...draft,
      repeat_interval: Math.max(1, interval),
      end_date:
        draft.end_type === RecurrenceEndType.ON_DATE ? draft.end_date : null,
      occurrence_limit:
        draft.end_type === RecurrenceEndType.AFTER_COUNT ? parsedCount : null,
    });
  };

  const primary = getPrimaryHex("text-primary-400", colorScheme);

  return (
    <AppSheet
      isOpen={isOpen}
      onClose={onClose}
      keyboardAvoiding
      footer={
        <Box className="items-center justify-center p-4">
          <HStack className="gap-x-2 w-full">
            {value && (
              <FormButton
                text="Don't Repeat"
                variant="outline"
                className="flex-1"
                onPress={() => onDone(null)}
              />
            )}
            <FormButton
              className="flex-1"
              text="Save Changes"
              disabled={!valid}
              onPress={handleSave}
            />
          </HStack>
        </Box>
      }
    >
      <Pressable onPress={onClose}>
        <HStack className="items-center pt-4 px-4">
          <Icon as="arrow-back-ios" className="text-secondary-950" />
          <Text bold className="text-xl">
            Repeat Expense
          </Text>
        </HStack>
      </Pressable>
      <Text className="text-sm text-secondary-950 px-4 pt-1 pb-2">
        Set up a recurring expense that automatically posts on a schedule.
      </Text>

      <ScrollView className="flex-1 px-4">
        <VStack className="gap-y-6 pt-2 pb-6">
          {/* Frequency */}
          <FormControl size="md">
            <FormControlLabel>
              <FormControlLabelText>Frequency</FormControlLabelText>
            </FormControlLabel>
            <HStack className="gap-x-2">
              {FREQUENCIES.map((f) => {
                const selected = draft.frequency === f.value;
                return (
                  <Pressable
                    key={f.value}
                    className={cn(
                      "flex-1 py-3 rounded-lg border items-center",
                      selected
                        ? "border-primary-400 bg-primary-0"
                        : "border-background-200",
                    )}
                    onPress={() =>
                      setDraft((d) => ({ ...d, frequency: f.value }))
                    }
                  >
                    <Text
                      className={cn(
                        selected ? "text-primary-400 font-bold" : "",
                      )}
                    >
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </HStack>
          </FormControl>

          {/* Interval */}
          <FormInput
            label="Repeat every"
            placeholder="1"
            keyboardType="number-pad"
            value={interval ? String(interval) : ""}
            onChangeText={(t) =>
              setDraft((d) => ({
                ...d,
                repeat_interval: parseInt(t, 10) || 0,
              }))
            }
            helperText={`Every ${Math.max(1, interval)} ${
              draft.frequency === RecurrenceFrequency.DAILY
                ? "day(s)"
                : draft.frequency === RecurrenceFrequency.WEEKLY
                  ? "week(s)"
                  : "month(s)"
            }`}
          />

          {/* Start date */}
          <FormControl size="md">
            <FormControlLabel>
              <FormControlLabelText>Starts on</FormControlLabelText>
            </FormControlLabel>
            <PressableListItem
              onPress={() => setStartPickerOpen(true)}
              className="p-4 border border-background-200 rounded-lg"
            >
              <HStack className="items-center gap-x-2">
                <CalendarDays
                  color={getSecondaryHex("text-secondary-950", colorScheme)}
                />
                <Text className="flex-1 text-lg">
                  {format(draft.start_date, "MMMM dd, yyyy")}
                </Text>
                <Icon as="unfold-more" className="text-sm text-secondary-950" />
              </HStack>
            </PressableListItem>
            <Text className="text-sm text-secondary-950 mt-1">
              If today or earlier, the first expense posts immediately.
            </Text>
          </FormControl>

          {/* End condition */}
          <FormControl size="md">
            <FormControlLabel>
              <FormControlLabelText>Ends</FormControlLabelText>
            </FormControlLabel>
            <HStack className="gap-x-2">
              {END_TYPES.map((e) => {
                const selected = draft.end_type === e.value;
                return (
                  <Pressable
                    key={e.value}
                    className={cn(
                      "flex-1 py-3 rounded-lg border items-center",
                      selected
                        ? "border-primary-400 bg-primary-0"
                        : "border-background-200",
                    )}
                    onPress={() =>
                      setDraft((d) => ({ ...d, end_type: e.value }))
                    }
                  >
                    <Text
                      className={cn(
                        selected ? "text-primary-400 font-bold" : "",
                      )}
                    >
                      {e.label}
                    </Text>
                  </Pressable>
                );
              })}
            </HStack>
          </FormControl>

          {draft.end_type === RecurrenceEndType.ON_DATE && (
            <PressableListItem
              onPress={() => setEndPickerOpen(true)}
              className="p-4 border border-background-200 rounded-lg"
            >
              <HStack className="items-center gap-x-2">
                <CalendarDays
                  color={getSecondaryHex("text-secondary-950", colorScheme)}
                />
                <Text className="flex-1 text-lg">
                  {draft.end_date
                    ? format(draft.end_date, "MMMM dd, yyyy")
                    : "Select end date"}
                </Text>
                <Icon as="unfold-more" className="text-sm text-secondary-950" />
              </HStack>
            </PressableListItem>
          )}

          {draft.end_type === RecurrenceEndType.AFTER_COUNT && (
            <FormInput
              label="Number of times"
              placeholder="12"
              keyboardType="number-pad"
              value={countText}
              onChangeText={setCountText}
              helperText="The series stops after this many occurrences."
            />
          )}
        </VStack>
      </ScrollView>

      {/* Date pickers live in a Modal so the inline calendar overlays the
          sheet (including the sticky Save button) instead of laying out
          beneath it. */}
      <Modal
        visible={startPickerOpen || endPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={closePickers}
      >
        <Pressable
          onPress={closePickers}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        />
        <Box className="absolute bottom-0 left-0 right-0 bg-background-0 rounded-t-3xl">
          <VStack className="w-full items-center pb-4">
            <VStack className="self-start px-4 pt-4">
              <Text bold className="text-xl">
                {endPickerOpen ? "Select End Date" : "Select Start Date"}
              </Text>
            </VStack>
            <DateTimePicker
              value={
                endPickerOpen
                  ? (draft.end_date ?? draft.start_date)
                  : draft.start_date
              }
              mode="date"
              display="inline"
              themeVariant={colorScheme}
              accentColor={primary}
              onChange={(_, date) => {
                const wasEnd = endPickerOpen;
                closePickers();
                if (date)
                  setDraft((d) =>
                    wasEnd
                      ? { ...d, end_date: date }
                      : { ...d, start_date: date },
                  );
              }}
            />
          </VStack>
        </Box>
      </Modal>
    </AppSheet>
  );
}
