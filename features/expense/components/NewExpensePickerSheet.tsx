import ListDivider from "@/components/ListDivider";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetFlatList,
  ActionsheetItem,
  ActionsheetItemText
} from "@/components/ui/actionsheet";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import { ListPlus, LucideIcon, Zap } from "lucide-react-native";
import { useMemo } from "react";
import { useColorScheme } from "react-native";

type PickerItem = {
  key: string;
  icon: LucideIcon;
  iconColor: string;
  label: string;
  description: string;
  onPress: () => void;
};

type NewExpensePickerSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  onQuickAdd: () => void;
  onCustom: () => void;
};

export default function NewExpensePickerSheet({
  isOpen,
  onClose,
  onQuickAdd,
  onCustom
}: NewExpensePickerSheetProps) {
  const colorScheme = useColorScheme() ?? "light";

  const items: PickerItem[] = useMemo(
    () => [
      {
        key: "quick-add",
        icon: Zap,
        iconColor: getPrimaryHex("text-primary-400", colorScheme),
        label: "Quick Add",
        description: "Paid by you · Equal split · Dated today",
        onPress: () => {
          onClose();
          setTimeout(onQuickAdd, 300);
        }
      },
      {
        key: "custom",
        icon: ListPlus,
        iconColor: getSecondaryHex("text-secondary-950", colorScheme),
        label: "Custom",
        description: "Full details, custom payers and split",
        onPress: onCustom
      }
    ],
    [colorScheme, onClose, onQuickAdd, onCustom]
  );

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="px-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full gap-y-4">
          <Text bold className="text-xl px-4">
            Add an Expense
          </Text>
          <ActionsheetFlatList
            data={items}
            keyExtractor={(item) => (item as PickerItem).key}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <ListDivider />}
            renderItem={({ item }) => {
              const {
                icon: Icon,
                iconColor,
                label,
                description,
                onPress
              } = item as PickerItem;

              return (
                <ActionsheetItem onPress={onPress}>
                  <HStack className="items-center gap-x-2 flex-1">
                    <Icon color={iconColor} />
                    <VStack className="flex-1">
                      <ActionsheetItemText className="text-lg font-semibold">
                        {label}
                      </ActionsheetItemText>
                      <Text className="text-secondary-950">{description}</Text>
                    </VStack>
                  </HStack>
                </ActionsheetItem>
              );
            }}
          />
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
