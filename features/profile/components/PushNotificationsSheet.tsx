import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { HStack } from "@/components/ui/hstack";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import states from "@/states";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import { useColorScheme } from "react-native";

export default function PushNotificationsSheet({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { notificationsEnabled, setNotificationsEnabled } = states.user();

  if (notificationsEnabled === undefined) return null;

  const colorScheme = useColorScheme() ?? "light";

  const handleToggle = async (value: boolean) => {
    await setNotificationsEnabled(value);
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[30]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full">
          <VStack className="p-4">
            <Text bold className="text-xl">
              Push Notifications
            </Text>
          </VStack>
          <HStack className="items-center justify-between p-4 rounded-xl">
            <VStack className="flex-1">
              <Text className="text-lg">Allow Push Notifications</Text>
              <Text className="text-secondary-950">
                Enable to receive updates and notifications about your account.
              </Text>
            </VStack>
            <Switch
              size="md"
              className="self-center"
              value={notificationsEnabled}
              onValueChange={handleToggle}
              trackColor={{
                false: getSecondaryHex("text-secondary-300", colorScheme),
                true: getPrimaryHex("text-primary-400", colorScheme)
              }}
            />
          </HStack>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
