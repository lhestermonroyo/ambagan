import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import {
  Radio,
  RadioGroup,
  RadioIcon,
  RadioIndicator
} from "@/components/ui/radio";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import states from "@/states";
import { AppearanceMode } from "@/types/user";
import { getPrimaryHex } from "@/utils/getColorHex";
import { CircleIcon, MonitorCog, Moon, Sun } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useMemo } from "react";

export default function AppearanceSheet({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { appearanceMode, setAppearanceMode } = states.user();

  if (!appearanceMode) return null;

  const { colorScheme, setColorScheme } = useColorScheme();

  const options: {
    icon: React.ReactNode;
    label: string;
    value: AppearanceMode;
    description: string;
  }[] = useMemo(
    () => [
      {
        icon: <Sun color={getPrimaryHex("text-primary-400", colorScheme)} />,
        label: "Light",
        value: "light",
        description: "Always use light theme"
      },
      {
        icon: <Moon color={getPrimaryHex("text-primary-400", colorScheme)} />,
        label: "Dark",
        value: "dark",
        description: "Always use dark theme"
      },
      {
        icon: (
          <MonitorCog color={getPrimaryHex("text-primary-400", colorScheme)} />
        ),
        label: "System",
        value: "system",
        description: "Follow system setting"
      }
    ],
    [colorScheme]
  );

  if (!appearanceMode) return null;

  const handleSelect = async (mode: AppearanceMode) => {
    setColorScheme(mode);
    await setAppearanceMode(mode);
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[30]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full gap-y-4">
          <VStack className="p-4">
            <Text bold className="text-xl">
              App Appearance
            </Text>
          </VStack>
          <RadioGroup
            value={appearanceMode}
            onChange={(val) => handleSelect(val as AppearanceMode)}
          >
            <FlatList
              scrollEnabled={false}
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <Radio
                  value={item.value}
                  size="lg"
                  className="justify-between px-4 py-3"
                >
                  <HStack className="flex-1 items-start gap-x-3">
                    {item.icon}
                    <VStack>
                      <Text className="text-lg">{item.label}</Text>
                    </VStack>
                  </HStack>
                  <RadioIndicator>
                    <RadioIcon as={CircleIcon} />
                  </RadioIndicator>
                </Radio>
              )}
              ItemSeparatorComponent={() => (
                <Box className="mx-4">
                  <Divider className="border-secondary-100" />
                </Box>
              )}
            />
          </RadioGroup>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
