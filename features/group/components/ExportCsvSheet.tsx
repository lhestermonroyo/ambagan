import FormButton from "@/components/FormButton";
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
  Radio,
  RadioGroup,
  RadioIcon,
  RadioIndicator
} from "@/components/ui/radio";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import services from "@/services";
import {
  DateRangeOption,
  dateRangeLabels,
  dateRangeOptions,
  getDateRangeCutoff
} from "@/features/group/components/DateRangeSheet";
import useAppToast from "@/hooks/use-app-toast";
import { exportGroupSettlementsAsCsv } from "@/utils/exportCsv";
import { CircleIcon } from "lucide-react-native";
import { useState } from "react";

export default function ExportCsvSheet({
  isOpen,
  onClose,
  groupId,
  groupName,
  userId
}: {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  userId: string;
}) {
  const [dateRange, setDateRange] = useState<DateRangeOption>("All");
  const [exporting, setExporting] = useState(false);

  const toast = useAppToast();

  const handleExport = async () => {
    setExporting(true);
    try {
      const cutoff = getDateRangeCutoff(dateRange);
      const payments = await services.expense.getPaymentsForExport(
        groupId,
        userId,
        cutoff
      );

      if (payments.length === 0) {
        toast({
          title: "No data",
          description: "No settlements found for the selected date range.",
          type: "info"
        });
        return;
      }

      await exportGroupSettlementsAsCsv(payments, groupName);
      onClose();
    } catch (error) {
      console.error("Export failed:", error);
      toast({
        title: "Export failed",
        description: "Could not export settlements. Please try again.",
        type: "error"
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full gap-y-4 pb-2">
          <VStack className="gap-y-1">
            <Text bold className="text-xl">
              Export Settlements
            </Text>
            <Text className="text-sm text-secondary-950">
              Select a date range to include in the CSV export.
            </Text>
          </VStack>

          <RadioGroup
            value={dateRange}
            onChange={(value) => setDateRange(value as DateRangeOption)}
          >
            <FlatList
              data={dateRangeOptions}
              keyExtractor={(item) => item}
              scrollEnabled={false}
              renderItem={({ item: option }) => (
                <Radio
                  value={option}
                  size="lg"
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

          <FormButton
            text="Export CSV"
            loading={exporting}
            onPress={handleExport}
          />
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
