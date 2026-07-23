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
import { SettlementView } from "@/types/user";
import { getPrimaryHex } from "@/utils/getColorHex";
import { CircleIcon, MoveRight, Rows2, Rows4 } from "lucide-react-native";
import { useMemo } from "react";
import { useColorScheme } from "react-native";

export default function SettlementViewSheet({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { settlementView, setSettlementView } = states.user();
  const toast = useAppToast();

  if (!settlementView || !setSettlementView) {
    return null;
  }

  const colorScheme = useColorScheme() ?? "light";

  const options: {
    icon: React.ReactNode;
    label: string;
    value: SettlementView;
    description: string;
  }[] = useMemo(
    () => [
      {
        icon: <Rows2 color={getPrimaryHex("text-primary-400", colorScheme)} />,
        label: "Full",
        value: "full",
        description: "Roomy cards with full member, payer and status details"
      },
      {
        icon: <Rows4 color={getPrimaryHex("text-primary-400", colorScheme)} />,
        label: "Compact",
        value: "compact",
        description: "Dense two-line rows — fit more on screen at a glance"
      },
      {
        icon: (
          <MoveRight color={getPrimaryHex("text-primary-400", colorScheme)} />
        ),
        label: "Arrow",
        value: "arrow",
        description: "Payer → receiver on a single line with an arrow"
      }
    ],
    [colorScheme]
  );

  const handleSelect = async (view: SettlementView) => {
    await setSettlementView(view);

    const label = options.find((option) => option.value === view)?.label;
    toast({
      title: "Settlement View Updated",
      description: `Settlement view set to ${label}.`,
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
          <VStack className="p-4">
            <Text bold className="text-xl">
              Settlement View
            </Text>
          </VStack>
          <RadioGroup
            value={settlementView}
            onChange={(val) => handleSelect(val as SettlementView)}
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
