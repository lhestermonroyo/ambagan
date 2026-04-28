import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import Icon from "./Icon";
import { Button } from "./ui/button";
import { HStack } from "./ui/hstack";

export default function NotificationSheet({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[94]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <VStack className="w-full p-4 flex-1 gap-6">
          <HStack className="items-center">
            <Button variant="link" className="rounded-full" onPress={onClose}>
              <Icon as="arrow-back-ios" className="text-secondary-950" />
            </Button>
            <Text bold className="text-xl">
              Notifications
            </Text>
          </HStack>
          <ScrollView className="flex-1" bounces={false}></ScrollView>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
