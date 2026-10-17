import FormButton from "@/components/FormButton";
import { Box } from "@/components/ui/box";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Image, useWindowDimensions } from "react-native";
import type { ImageSourcePropType } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SuccessFeedback({
  title,
  description,
  illustration,
  onClose
}: {
  title: string;
  description: string;
  illustration: ImageSourcePropType;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const artSize = Math.max(140, Math.min(240, height * 0.28, width - 48));
  const circleSize = artSize * 0.8;

  return (
    <SafeAreaView className="flex-1 bg-background-0" edges={["top", "bottom"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: 24,
          paddingVertical: 32
        }}
        showsVerticalScrollIndicator={false}
      >
        <VStack className="items-center gap-y-8">
          <Box
            className="relative items-center justify-center"
            style={{ width: artSize, height: artSize }}
          >
            <Box
              className="absolute bg-primary-0 dark:bg-primary-50"
              style={{
                width: circleSize,
                height: circleSize,
                borderRadius: circleSize / 2
              }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
            <Image
              source={illustration}
              style={{ width: artSize, height: artSize }}
              resizeMode="contain"
              accessible={false}
            />
          </Box>
          <VStack className="gap-y-3">
            <Text bold className="text-center text-3xl" accessibilityRole="header">
              {title}
            </Text>
            <Text className="text-center text-lg text-secondary-950">
              {description}
            </Text>
          </VStack>
        </VStack>
      </ScrollView>
      <Box className="px-6 pb-4 pt-2">
        <FormButton text="Close" variant="outline" onPress={onClose} />
      </Box>
    </SafeAreaView>
  );
}
