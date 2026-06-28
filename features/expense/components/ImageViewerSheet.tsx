import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Image } from "expo-image";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { getSecondaryHex } from "@/utils/getColorHex";
import { X } from "lucide-react-native";
import { useColorScheme } from "react-native";

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
  const colorScheme = useColorScheme() ?? "light";

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[90]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full flex-1">
          <HStack className="px-4 py-3 items-center justify-between">
            <Text bold className="text-xl">
              {title}
            </Text>
            <Pressable onPress={onClose}>
              <X
                size={22}
                color={getSecondaryHex("text-secondary-950", colorScheme)}
              />
            </Pressable>
          </HStack>

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
