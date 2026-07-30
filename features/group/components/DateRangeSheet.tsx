import FormButton from "@/components/FormButton";
import SelectField from "@/components/SelectField";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText
} from "@/components/ui/form-control";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import {
  Radio,
  RadioGroup,
  RadioIcon,
  RadioIndicator
} from "@/components/ui/radio";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import { CalendarDays, ChevronLeft, CircleIcon } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Modal, useColorScheme } from "react-native";

export const dateRangeOptions = [
  "All",
  "1D",
  "1W",
  "2W",
  "1M",
  "3M",
  "6M",
  "1Y"
] as const;

/** The preset ranges plus "Custom", which is paired with a {@link CustomDateRange}. */
export type DateRangeOption = (typeof dateRangeOptions)[number] | "Custom";

/** An explicit start/end pair picked by the user, inclusive of both days. */
export type CustomDateRange = { start: Date; end: Date };

export const dateRangeLabels: Record<DateRangeOption, string> = {
  All: "All Time",
  "1D": "Last 24 Hours",
  "1W": "Last 7 Days",
  "2W": "Last 2 Weeks",
  "1M": "Last Month",
  "3M": "Last 3 Months",
  "6M": "Last 6 Months",
  "1Y": "Last Year",
  Custom: "Custom Range"
};

const startOfDay = (d: Date) => {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const endOfDay = (d: Date) => {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy;
};

/**
 * Resolves a selection into the concrete window to filter by. Presets are
 * open-ended (`end: null` — everything up to now); a custom range is bounded on
 * both sides and snapped to whole days so both picked dates are included.
 */
export const getDateRangeBounds = (
  range: DateRangeOption,
  custom?: CustomDateRange | null
): { start: Date | null; end: Date | null } => {
  if (range === "All") return { start: null, end: null };
  if (range === "Custom") {
    if (!custom) return { start: null, end: null };
    return { start: startOfDay(custom.start), end: endOfDay(custom.end) };
  }
  const days: Record<Exclude<DateRangeOption, "All" | "Custom">, number> = {
    "1D": 1,
    "1W": 7,
    "2W": 14,
    "1M": 30,
    "3M": 90,
    "6M": 180,
    "1Y": 365
  };
  return {
    start: new Date(Date.now() - days[range] * 24 * 60 * 60 * 1000),
    end: null
  };
};

export const getDateRangeCutoff = (
  range: DateRangeOption,
  custom?: CustomDateRange | null
): Date | null => getDateRangeBounds(range, custom).start;

export const getDateRangeEnd = (
  range: DateRangeOption,
  custom?: CustomDateRange | null
): Date | null => getDateRangeBounds(range, custom).end;

/** True when `value` falls inside the (possibly open-ended) window. */
export const isWithinRange = (
  value: string | Date,
  start: Date | null,
  end: Date | null
) => {
  const date = new Date(value);
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
};

/** Pill/button label — presets use their fixed label, custom shows the dates. */
export const formatDateRangeLabel = (
  range: DateRangeOption,
  custom?: CustomDateRange | null
) => {
  if (range === "Custom" && custom) {
    const sameYear = custom.start.getFullYear() === custom.end.getFullYear();
    return `${format(custom.start, sameYear ? "MMM d" : "MMM d, yyyy")} – ${format(
      custom.end,
      "MMM d, yyyy"
    )}`;
  }
  return dateRangeLabels[range];
};

export default function DateRangeSheet({
  isOpen,
  onClose,
  dateRange,
  customRange,
  onSelect
}: {
  isOpen: boolean;
  onClose: () => void;
  dateRange: DateRangeOption;
  /** The committed custom window, when `dateRange` is "Custom". */
  customRange?: CustomDateRange | null;
  onSelect: (v: DateRangeOption, custom?: CustomDateRange | null) => void;
}) {
  const colorScheme = (useColorScheme() ?? "light") as "light" | "dark";

  // The sheet has two steps: the preset list, and the custom start/end picker
  // reached from the button at the bottom.
  const [step, setStep] = useState<"presets" | "custom">("presets");
  const [draftStart, setDraftStart] = useState<Date>(
    customRange?.start ?? new Date()
  );
  const [draftEnd, setDraftEnd] = useState<Date>(
    customRange?.end ?? new Date()
  );
  const [picker, setPicker] = useState<"start" | "end" | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setStep("presets");
    setPicker(null);
    setDraftStart(customRange?.start ?? new Date());
    setDraftEnd(customRange?.end ?? new Date());
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const validRange = startOfDay(draftStart) <= startOfDay(draftEnd);

  const handleApply = () => {
    onSelect("Custom", { start: draftStart, end: draftEnd });
    onClose();
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full gap-y-4">
          {step === "presets" ? (
            <>
              <Text bold className="text-xl">
                Date Range
              </Text>
              <RadioGroup
                value={dateRange}
                onChange={(value) => {
                  onSelect(value as DateRangeOption, null);
                  onClose();
                }}
              >
                <FlatList
                  data={dateRangeOptions}
                  keyExtractor={(item) => item}
                  scrollEnabled={false}
                  renderItem={({ item: option }) => (
                    <Radio
                      value={option}
                      size="md"
                      className="justify-between py-4"
                    >
                      <Text className="text-lg">{dateRangeLabels[option]}</Text>
                      <RadioIndicator>
                        <RadioIcon as={CircleIcon} />
                      </RadioIndicator>
                    </Radio>
                  )}
                  ItemSeparatorComponent={() => (
                    <Box className="mx-0">
                      <Divider className="border-secondary-100" />
                    </Box>
                  )}
                />
              </RadioGroup>

              {/* Escape hatch from the presets — pick an exact start and end. */}
              <FormButton
                variant="outline"
                text={
                  dateRange === "Custom" && customRange
                    ? formatDateRangeLabel(dateRange, customRange)
                    : "Custom Range"
                }
                icon={
                  <CalendarDays
                    size={18}
                    color={getPrimaryHex("text-primary-500", colorScheme)}
                  />
                }
                onPress={() => setStep("custom")}
              />
            </>
          ) : (
            <VStack className="w-full gap-y-6">
              <HStack className="items-center gap-x-2">
                <Pressable
                  onPress={() => setStep("presets")}
                  hitSlop={8}
                  accessibilityLabel="Back to presets"
                >
                  <ChevronLeft
                    size={24}
                    color={getSecondaryHex("text-secondary-950", colorScheme)}
                  />
                </Pressable>
                <Text bold className="text-xl">
                  Custom Range
                </Text>
              </HStack>

              <VStack className="gap-y-4">
                <FormControl size="md">
                  <FormControlLabel>
                    <FormControlLabelText>Start Date</FormControlLabelText>
                  </FormControlLabel>
                  <SelectField
                    onPress={() => setPicker("start")}
                    leading={
                      <CalendarDays
                        size={20}
                        color={getSecondaryHex(
                          "text-secondary-950",
                          colorScheme
                        )}
                      />
                    }
                  >
                    <Text className="text-lg" numberOfLines={1}>
                      {format(draftStart, "MMMM dd, yyyy")}
                    </Text>
                  </SelectField>
                </FormControl>

                <FormControl size="md">
                  <FormControlLabel>
                    <FormControlLabelText>End Date</FormControlLabelText>
                  </FormControlLabel>
                  <SelectField
                    onPress={() => setPicker("end")}
                    leading={
                      <CalendarDays
                        size={20}
                        color={getSecondaryHex(
                          "text-secondary-950",
                          colorScheme
                        )}
                      />
                    }
                  >
                    <Text className="text-lg" numberOfLines={1}>
                      {format(draftEnd, "MMMM dd, yyyy")}
                    </Text>
                  </SelectField>
                </FormControl>

                {!validRange && (
                  <Text className="text-sm text-error-400">
                    The end date must be on or after the start date.
                  </Text>
                )}
              </VStack>

              <FormButton
                text="Apply Range"
                disabled={!validRange}
                onPress={handleApply}
              />
            </VStack>
          )}
        </VStack>

        {/* The inline calendar lives in a Modal so it overlays the sheet
            instead of laying out inside it. */}
        <Modal
          visible={picker !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setPicker(null)}
        >
          <Pressable
            onPress={() => setPicker(null)}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.5)"
            }}
          />
          <Box className="absolute bottom-0 left-0 right-0 bg-background-0 rounded-t-3xl">
            <VStack className="w-full items-center pb-4">
              <VStack className="self-start px-4 pt-4">
                <Text bold className="text-xl">
                  {picker === "end" ? "Select End Date" : "Select Start Date"}
                </Text>
              </VStack>
              <DateTimePicker
                value={picker === "end" ? draftEnd : draftStart}
                mode="date"
                display="inline"
                themeVariant={colorScheme}
                accentColor={getPrimaryHex("text-primary-400", colorScheme)}
                onChange={(_, date) => {
                  const wasEnd = picker === "end";
                  setPicker(null);
                  if (!date) return;
                  if (wasEnd) {
                    setDraftEnd(date);
                  } else {
                    setDraftStart(date);
                    // Keep the window valid — drag the end along when the new
                    // start passes it.
                    setDraftEnd((prev) => (prev < date ? date : prev));
                  }
                }}
              />
            </VStack>
          </Box>
        </Modal>
      </ActionsheetContent>
    </Actionsheet>
  );
}
