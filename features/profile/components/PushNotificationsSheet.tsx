import FormButton from "@/components/FormButton";
import ListDivider from "@/components/ListDivider";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import services from "@/services";
import states from "@/states";
import { UserPreferences } from "@/types/user";
import {
  getErrorHex,
  getPrimaryHex,
  getSecondaryHex
} from "@/utils/getColorHex";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { AlertCircle, BellOff } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Linking, useColorScheme } from "react-native";

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
  const {
    details: userDetails,
    preferences,
    updatePreferences
  } = states.user();

  const colorScheme = useColorScheme() ?? "light";
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    Notifications.getPermissionsAsync().then(({ status }) => {
      setPermissionStatus(status);
    });
  }, [isOpen]);

  if (!userDetails || !preferences) return null;

  const switchColors = {
    false: getSecondaryHex("text-secondary-300", colorScheme),
    true: getPrimaryHex("text-primary-400", colorScheme)
  };

  const handleToggle = async (key: NotifKey, value: boolean) => {
    await updatePreferences({ [key]: value });
  };

  const handleEnableNotifications = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setPermissionStatus(status);
    if (status === "granted" && userDetails?.id) {
      try {
        const { data: token } = await Notifications.getExpoPushTokenAsync({
          projectId: Constants.expoConfig?.extra?.eas?.projectId
        });
        await services.pushToken.registerPushToken(userDetails.id, token);
      } catch (error) {
        console.error("Failed to register push token:", error);
      }
    }
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[90]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full flex-1">
          <VStack className="p-4">
            <Text bold className="text-xl">
              Push Notifications
            </Text>
          </VStack>

          <ScrollView className="flex-1 w-full">
            {permissionStatus === "undetermined" && (
              <VStack className="mx-4 p-4 bg-primary-50 rounded-xl gap-y-4">
                <HStack className="gap-x-2 items-start">
                  <AlertCircle
                    color={getPrimaryHex("text-primary-500", colorScheme)}
                  />
                  <VStack className="flex-1 gap-y-2">
                    <Text bold className="text-lg text-primary-600">
                      Notifications not enabled
                    </Text>
                    <Text className="text-primary-500">
                      You haven't enabled push notifications yet. Enable them to
                      get real-time updates on settlements, expenses, and group
                      activity.
                    </Text>
                  </VStack>
                </HStack>
                <FormButton
                  text="Enable Notifications"
                  onPress={handleEnableNotifications}
                />
              </VStack>
            )}

            {permissionStatus === "denied" && (
              <VStack className="mx-4 p-4 bg-error-50 rounded-xl gap-y-4">
                <HStack className="gap-x-2 items-start">
                  <BellOff color={getErrorHex("text-error-500", colorScheme)} />
                  <VStack className="flex-1 gap-y-2">
                    <Text bold className="text-lg text-error-600">
                      Notifications are disabled
                    </Text>
                    <Text className="text-error-500">
                      Push notifications are turned off in your device settings.
                      Go to Settings to allow us to send you notifications.
                    </Text>
                  </VStack>
                </HStack>
                <FormButton
                  text="Open Settings"
                  onPress={() => Linking.openSettings()}
                />
              </VStack>
            )}

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
                  ItemSeparatorComponent={ListDivider}
                />
              </VStack>
            ))}
          </ScrollView>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
