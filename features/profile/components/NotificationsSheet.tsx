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

export default function NotificationsSheet({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { notificationsEnabled, setNotificationsEnabled } = states.user();

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
        <VStack className="w-full p-4 gap-y-4">
          <Text bold className="text-xl">
            Notifications
          </Text>
          <HStack className="items-center justify-between p-3 bg-secondary-100 rounded-xl">
            <VStack className="flex-1">
              <Text className="text-lg">Allow Notifications</Text>
              <Text className="text-secondary-950">
                Receive alerts for group activity and settlements
              </Text>
            </VStack>
            <Switch
              size="md"
              value={notificationsEnabled}
              onValueChange={handleToggle}
              trackColor={{ false: "#d1d5db", true: undefined }}
            />
          </HStack>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
