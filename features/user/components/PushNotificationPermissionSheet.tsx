import FormButton from "@/components/FormButton";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import services from "@/services";
import states from "@/states";
import { getPrimaryHex } from "@/utils/getColorHex";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Bell } from "lucide-react-native";
import { useColorScheme } from "react-native";

export default function PushNotificationPermissionSheet({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { details: userDetails } = states.user();
  const colorScheme = useColorScheme() ?? "light";

  const handleEnable = async () => {
    onClose();
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted" || !userDetails?.id) return;
      const { data: token } = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId
      });
      await services.pushToken.registerPushToken(userDetails.id, token);
    } catch (error) {
      console.error("Failed to register push token:", error);
    }
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[40]}>
      <ActionsheetBackdrop />
      <ActionsheetContent>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full gap-y-6 py-4 items-center">
          <VStack className="items-center gap-y-4">
            <VStack className="bg-primary-100 rounded-full p-6">
              <Bell
                size={36}
                color={getPrimaryHex("text-primary-500", colorScheme)}
              />
            </VStack>
            <VStack className="gap-y-2 items-center">
              <Text bold className="text-2xl text-center">
                Stay in the loop!
              </Text>
              <Text className="text-sm text-secondary-950 text-center px-4">
                Enable push notifications to get updates on settlements,
                expenses, and group activity.
              </Text>
            </VStack>
          </VStack>
          <VStack className="w-full gap-y-2">
            <FormButton text="Enable Notifications" onPress={handleEnable} />
            <FormButton
              text="Maybe Later"
              variant="outline"
              onPress={onClose}
            />
          </VStack>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
