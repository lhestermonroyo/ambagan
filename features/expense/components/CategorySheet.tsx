import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import CategoryIcon from "@/components/CategoryIcon";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import {
  Radio,
  RadioGroup,
  RadioIcon,
  RadioIndicator
} from "@/components/ui/radio";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { categories, CategoryOption, expenseCategories } from "@/utils/constants";
import { CircleIcon } from "lucide-react-native";

/** Full option (label + icon) for a stored category value, falling back to
 *  "Other" for anything unrecognized (e.g. a value from a newer client). */
export const expenseCategoryMeta = (value: string): CategoryOption =>
  expenseCategories.find((c) => c.value === value) ??
  expenseCategories[expenseCategories.length - 1];

/** Label for a stored category value. */
export const expenseCategoryLabel = (value: string): string =>
  expenseCategoryMeta(value).label;

/** Full option (label + icon) for a stored group category value, falling back to
 *  "Other" for anything unrecognized (e.g. a value from a newer client). */
export const groupCategoryMeta = (value: string): CategoryOption =>
  categories.find((c) => c.value === value) ??
  categories[categories.length - 1];

export default function CategorySheet({
  isOpen,
  onClose,
  category,
  onSelect,
  // Defaults to the expense categories so existing callers stay unchanged;
  // group/book forms pass their own `categories` set.
  options = expenseCategories,
  title = "Category"
}: {
  isOpen: boolean;
  onClose: () => void;
  category: string;
  onSelect: (v: string) => void;
  options?: CategoryOption[];
  title?: string;
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
            {title}
          </Text>
          <RadioGroup
            value={category}
            onChange={(value) => {
              onSelect(value);
              onClose();
            }}
          >
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              scrollEnabled={false}
              renderItem={({ item: option }) => (
                <Radio
                  value={option.value}
                  size="md"
                  className="justify-between py-4"
                >
                  <HStack className="items-center gap-x-3">
                    <CategoryIcon icon={option.icon} />
                    <Text className="text-lg">{option.label}</Text>
                  </HStack>
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
