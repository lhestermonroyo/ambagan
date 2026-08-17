import ListDivider from "@/components/ListDivider";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
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
import useAppToast from "@/hooks/use-app-toast";
import states from "@/states";
import { HeroView } from "@/types/user";
import { getPrimaryHex } from "@/utils/getColorHex";
import { CircleIcon, Scale, Wallet } from "lucide-react-native";
import { useMemo } from "react";
import { useColorScheme } from "react-native";

/**
 * Which page the Overview's hero pager opens on. Both pages stay one swipe (or
 * one arrow tap) away whichever is chosen — this is about where a launch lands,
 * which is why the copy talks about opening rather than showing or hiding.
 */
export default function HeroViewSheet({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { heroView, setHeroView } = states.user();
  const toast = useAppToast();

  if (!heroView) return null;

  const colorScheme = useColorScheme() ?? "light";

  const options: {
    icon: React.ReactNode;
    label: string;
    value: HeroView;
    description: string;
  }[] = useMemo(
    () => [
      {
        icon: <Scale color={getPrimaryHex("text-primary-400", colorScheme)} />,
        label: "Net Balance",
        value: "balance",
        description: "What your groups owe you, and what you owe them"
      },
      {
        icon: <Wallet color={getPrimaryHex("text-primary-400", colorScheme)} />,
        label: "Personal Spending",
        value: "personal",
        description: "This month's own spending, trend and budgets"
      }
    ],
    [colorScheme]
  );

  const handleSelect = async (view: HeroView) => {
    await setHeroView(view);

    const label = options.find((option) => option.value === view)?.label;
    toast({
      title: "Overview Updated",
      description: `Overview now opens on ${label}.`,
      type: "success"
    });
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full gap-y-4">
          <VStack className="p-4 gap-y-1">
            <Text bold className="text-xl">
              Overview Hero
            </Text>
            <Text className="text-sm text-secondary-950">
              Which card the Overview opens on. The other stays one swipe away.
            </Text>
          </VStack>
          <RadioGroup
            value={heroView}
            onChange={(val) => handleSelect(val as HeroView)}
          >
            <FlatList
              scrollEnabled={false}
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <Radio
                  value={item.value}
                  size="md"
                  className="justify-between px-4 py-3"
                >
                  <HStack className="flex-1 items-start gap-x-3">
                    {item.icon}
                    <VStack className="flex-1">
                      <Text className="text-lg">{item.label}</Text>
                      <Text className="text-sm text-secondary-950">
                        {item.description}
                      </Text>
                    </VStack>
                  </HStack>
                  <RadioIndicator>
                    <RadioIcon as={CircleIcon} />
                  </RadioIndicator>
                </Radio>
              )}
              ItemSeparatorComponent={ListDivider}
            />
          </RadioGroup>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
