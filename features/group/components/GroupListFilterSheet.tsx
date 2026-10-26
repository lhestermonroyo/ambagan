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
import { CircleIcon } from "lucide-react-native";

import type { GroupFilter } from "@/features/group/services/group.service";
import { GroupMode } from "@/types/groups";

const filterOptions: { value: GroupFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "created", label: "Created" },
  { value: "joined", label: "Joined" },
  { value: "archived", label: "Archived" }
];

export const groupFilterLabel = (value: GroupFilter) =>
  filterOptions.find((option) => option.value === value)?.label ?? "All";

/** The list's filter chooser, matching the settlement status selector. */
export default function GroupListFilterSheet({
  isOpen,
  onClose,
  filter,
  mode,
  onSelect
}: {
  isOpen: boolean;
  onClose: () => void;
  filter: GroupFilter;
  mode: GroupMode;
  onSelect: (filter: GroupFilter) => void;
}) {
  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full gap-y-4">
          <Text bold className="text-xl">
            Show
          </Text>
          <RadioGroup
            value={filter}
            onChange={(value) => {
              onSelect(value as GroupFilter);
              onClose();
            }}
          >
            <FlatList
              data={mode === GroupMode.INDIVIDUAL
                ? filterOptions.filter((option) => option.value === "all" || option.value === "archived")
                : filterOptions}
              keyExtractor={(item) => item.value}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <Radio
                  value={item.value}
                  size="md"
                  className="justify-between py-4"
                >
                  <Text className="text-lg">{item.label}</Text>
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
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
