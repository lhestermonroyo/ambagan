import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import Icon from "@/components/Icon";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Image } from "expo-image";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

export default function ImageViewerSheet({
  isOpen,
  onClose,
  uri,
  title = "Image"
}: {
  isOpen: boolean;
  onClose: () => void;
  uri: string | null;
  title?: string;
}) {
  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[90]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full flex-1">
          <Pressable onPress={onClose}>
            <HStack className="p-4 items-center">
              <Icon as="arrow-back-ios" className="text-secondary-950" />
              <Text bold className="text-xl">
                {title}
              </Text>
            </HStack>
          </Pressable>

          <Box className="flex-1 px-4 pb-6 justify-center">
            {uri ? (
              <Image
                source={{ uri }}
                contentFit="contain"
                cachePolicy="memory-disk"
                className="w-full h-full rounded-xl"
              />
            ) : (
              <Box className="flex-1 items-center justify-center">
                <Text className="text-sm text-secondary-950">No image available</Text>
              </Box>
            )}
          </Box>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
