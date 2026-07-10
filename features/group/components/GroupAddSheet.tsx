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
import { HousePlus, LucideIcon, QrCode } from "lucide-react-native";
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

type GroupAddSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: () => void;
  onScan: () => void;
};

export default function GroupAddSheet({
  isOpen,
  onClose,
  onCreate,
  onScan
}: GroupAddSheetProps) {
  const colorScheme = useColorScheme() ?? "light";

  const items: PickerItem[] = useMemo(
    () => [
      {
        key: "create",
        icon: HousePlus,
        iconColor: getSecondaryHex("text-secondary-950", colorScheme),
        label: "Create Group",
        description: "Start a new group and invite members",
        onPress: onCreate
      },
      {
        key: "scan",
        icon: QrCode,
        iconColor: getPrimaryHex("text-primary-400", colorScheme),
        label: "Scan to Join",
        description: "Join an existing group with a QR code",
        onPress: onScan
      }
    ],
    [colorScheme, onCreate, onScan]
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
            Add a Group
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
                      <Text className="text-sm text-secondary-950">
                        {description}
                      </Text>
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
