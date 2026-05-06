import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import states from "@/states";
import { AppearanceMode } from "@/types/user";
import { getPrimaryHex } from "@/utils/getColorHex";
import { Check } from "lucide-react-native";
import { useColorScheme } from "nativewind";

const options: { label: string; value: AppearanceMode; description: string }[] =
  [
    {
      label: "Light",
      value: "light",
      description: "Always use light theme"
    },
    {
      label: "Dark",
      value: "dark",
      description: "Always use dark theme"
    },
    {
      label: "System",
      value: "system",
      description: "Follow system setting"
    }
  ];

export default function AppearanceSheet({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { appearanceMode, setAppearanceMode } = states.user();
  const { setColorScheme } = useColorScheme();

  const handleSelect = async (mode: AppearanceMode) => {
    setColorScheme(mode);
    await setAppearanceMode(mode);
    onClose();
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[40]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full p-4 gap-y-4">
          <Text bold className="text-xl">
            App Appearance
          </Text>
          <VStack className="gap-y-1">
            {options.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => handleSelect(option.value)}
              >
                <HStack className="p-3 rounded-xl items-center gap-x-3">
                  <VStack className="flex-1">
                    <Text className="text-lg">{option.label}</Text>
                    <Text className="text-secondary-950">
                      {option.description}
                    </Text>
                  </VStack>
                  {appearanceMode === option.value && (
                    <Box>
                      <Check
                        size={20}
                        color={getPrimaryHex("text-primary-400")}
                      />
                    </Box>
                  )}
                </HStack>
              </Pressable>
            ))}
          </VStack>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
