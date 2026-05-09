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
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import states from "@/states";
import { UserPreferences } from "@/types/user";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import { useColorScheme } from "react-native";

type NotifKey = keyof Pick<
  UserPreferences,
  | "notif_settlement_request"
  | "notif_settlement_approved"
  | "notif_settlement_rejected"
  | "notif_settlement_completed"
  | "notif_expense_inclusion"
  | "notif_group_join"
  | "notif_group_leave"
>;

type NotifItem = { key: NotifKey; label: string; description: string };

const SECTIONS: { title: string; data: NotifItem[] }[] = [
  {
    title: "Settlements",
    data: [
      {
        key: "notif_settlement_request",
        label: "Settlement Request",
        description: "When someone requests a settlement from you"
      },
      {
        key: "notif_settlement_approved",
        label: "Settlement Approved",
        description: "When your settlement request is approved"
      },
      {
        key: "notif_settlement_rejected",
        label: "Settlement Rejected",
        description: "When your settlement request is rejected"
      },
      {
        key: "notif_settlement_completed",
        label: "Settlement Completed",
        description: "When a settlement is marked as completed"
      }
    ]
  },
  {
    title: "Expenses",
    data: [
      {
        key: "notif_expense_inclusion",
        label: "Expense Inclusion",
        description: "When you're added to a new expense"
      }
    ]
  },
  {
    title: "Groups",
    data: [
      {
        key: "notif_group_join",
        label: "Member Joined",
        description: "When someone joins your group"
      },
      {
        key: "notif_group_leave",
        label: "Member Left",
        description: "When someone leaves your group"
      }
    ]
  }
];

export default function PushNotificationsSheet({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { preferences, updatePreferences } = states.user();

  if (!preferences) return null;

  const colorScheme = useColorScheme() ?? "light";

  const switchColors = {
    false: getSecondaryHex("text-secondary-300", colorScheme),
    true: getPrimaryHex("text-primary-400", colorScheme)
  };

  const handleToggle = async (key: NotifKey, value: boolean) => {
    await updatePreferences({ [key]: value });
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[90]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full p-4">
          <Text bold className="text-xl">
            Push Notifications
          </Text>
        </VStack>
        <ScrollView className="flex-1 w-full" bounces={false}>
          {SECTIONS.map((section) => (
            <VStack key={section.title}>
              <Box className="px-4 pt-5 pb-2">
                <Text bold className="text-xl">
                  {section.title}
                </Text>
              </Box>
              <FlatList
                data={section.data}
                keyExtractor={(item) => item.key}
                scrollEnabled={false}
                bounces={false}
                renderItem={({ item }) => (
                  <HStack className="items-center justify-between px-4 py-3">
                    <VStack className="flex-1 pr-4">
                      <Text className="text-lg">{item.label}</Text>
                      <Text className="text-secondary-950">
                        {item.description}
                      </Text>
                    </VStack>
                    <Switch
                      size="sm"
                      value={preferences[item.key]}
                      onValueChange={(val) => handleToggle(item.key, val)}
                      trackColor={switchColors}
                    />
                  </HStack>
                )}
                ItemSeparatorComponent={() => (
                  <Box className="mx-4">
                    <Divider className="border-secondary-100" />
                  </Box>
                )}
              />
            </VStack>
          ))}
        </ScrollView>
      </ActionsheetContent>
    </Actionsheet>
  );
}
