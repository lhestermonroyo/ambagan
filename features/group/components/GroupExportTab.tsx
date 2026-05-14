import FormButton from "@/components/FormButton";
import UpgradeSheet from "@/components/UpgradeSheet";
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
import {
  DateRangeOption,
  dateRangeLabels,
  dateRangeOptions,
  getDateRangeCutoff
} from "@/features/group/components/DateRangeSheet";
import useAppToast from "@/hooks/use-app-toast";
import services from "@/services";
import { exportGroupSettlementsAsCsv } from "@/utils/exportCsv";
import { CircleIcon } from "lucide-react-native";
import { useState } from "react";

export default function GroupExportTab({
  groupId,
  groupName,
  userId,
  isPro
}: {
  groupId: string;
  groupName: string;
  userId: string;
  isPro: boolean;
}) {
  const [dateRange, setDateRange] = useState<DateRangeOption>("All");
  const [exporting, setExporting] = useState(false);
  const [upgradeSheetOpen, setUpgradeSheetOpen] = useState(false);

  const toast = useAppToast();

  const handleExport = async () => {
    if (!isPro) {
      setUpgradeSheetOpen(true);
      return;
    }

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
    <VStack className="px-4 gap-y-6">
      <VStack className="gap-y-1">
        <Text bold className="text-xl">
          Export Settlements
        </Text>
        <Text className="text-secondary-950">
          Download a CSV file of all settlements you're involved in for this
          group.
        </Text>
      </VStack>

      <VStack className="gap-y-2">
        <Text className="font-medium">Date Range</Text>
        <Box className="rounded-xl overflow-hidden border border-secondary-500">
          <RadioGroup
            value={dateRange}
            onChange={(value) => setDateRange(value as DateRangeOption)}
          >
            <FlatList
              data={dateRangeOptions}
              keyExtractor={(item) => item}
              scrollEnabled={false}
              renderItem={({ item: option }) => (
                <Radio value={option} size="lg" className="justify-between p-4">
                  <Text>{dateRangeLabels[option]}</Text>
                  <RadioIndicator>
                    <RadioIcon as={CircleIcon} />
                  </RadioIndicator>
                </Radio>
              )}
              ItemSeparatorComponent={() => (
                <Divider className="border-secondary-100" />
              )}
            />
          </RadioGroup>
        </Box>
      </VStack>

      <FormButton
        text={isPro ? "Export CSV" : "Export CSV (Pro)"}
        loading={exporting}
        onPress={handleExport}
      />

      <UpgradeSheet
        isOpen={upgradeSheetOpen}
        onClose={() => setUpgradeSheetOpen(false)}
      />
    </VStack>
  );
}
