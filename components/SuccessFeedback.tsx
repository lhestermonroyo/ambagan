import FormButton from "@/components/FormButton";
import { Box } from "@/components/ui/box";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import ArtBlob from "@/features/user/components/ArtBlob";
import { BLOB_ACCENTS } from "@/features/user/components/art";
import { getPrimaryHex } from "@/utils/getColorHex";
import { ImageIcon } from "lucide-react-native";
import { useColorScheme, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SuccessFeedback({
  title,
  description,
  onClose
}: {
  title: string;
  description: string;
  onClose: () => void;
}) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const { width, height } = useWindowDimensions();
  const artSize = Math.max(140, Math.min(240, height * 0.28, width - 48));

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
            style={{ width: artSize, height: artSize }}
            className="items-center justify-center"
            accessible
            accessibilityLabel="Illustration placeholder"
          >
            <Box className="absolute">
              <ArtBlob
                size={artSize}
                index={0}
                accent={BLOB_ACCENTS.violet}
                isDark={scheme === "dark"}
              />
            </Box>
            <ImageIcon
              size={64}
              strokeWidth={1.5}
              color={getPrimaryHex("text-primary-600", scheme)}
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
