import { currencies } from "@/utils/constants";
import { getSecondaryHex } from "@/utils/getColorHex";
import { ChevronDown, CircleIcon } from "lucide-react-native";
import { useColorScheme } from "react-native";
import { Fragment, useMemo, useState } from "react";
import FormButton from "./FormButton";
import Icon from "./Icon";
import PressableListItem from "./PressableListItem";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "./ui/actionsheet";
import { Box } from "./ui/box";
import { Button } from "./ui/button";
import { Divider } from "./ui/divider";
import { FlatList } from "./ui/flat-list";
import { HStack } from "./ui/hstack";
import { Radio, RadioGroup, RadioIcon, RadioIndicator } from "./ui/radio";
import { Text } from "./ui/text";
import { VStack } from "./ui/vstack";

const CurrencySelection = ({
  currency,
  onCurrencyChange
}: {
  currency: string;
  onCurrencyChange: (currency: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState(currency);
  const colorScheme = useColorScheme() ?? "light";

  const currencyLabel = useMemo(() => {
    return currencies.find((c) => c.value === currency)?.label;
  }, [currency]);

  return (
    <Fragment>
      <PressableListItem
        onPress={() => setIsOpen(true)}
        className="border border-secondary-500 items-center justify-center h-full px-2 py-2 rounded-lg"
      >
        <HStack className="items-center justify-center gap-x-1">
          <Text className="font-semibold">{currencyLabel}</Text>
          <ChevronDown
            size={18}
            color={getSecondaryHex("text-secondary-950", colorScheme)}
          />
        </HStack>
      </PressableListItem>
      <Actionsheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        snapPoints={[94]}
      >
        <ActionsheetBackdrop />
        <ActionsheetContent className="p-0">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>

          <VStack className="w-full py-4 flex-1 gap-y-4">
            <HStack className="items-center px-4">
              <Button
                variant="link"
                className="rounded-full"
                onPress={() => setIsOpen(false)}
              >
                <Icon as="arrow-back-ios" className="text-secondary-950" />
              </Button>
              <Text bold className="text-xl">
                Select Currency
              </Text>
            </HStack>
            <RadioGroup
              className="flex-1"
              value={selected.toString()}
              onChange={(value) => setSelected(value)}
            >
              <FlatList
                data={currencies}
                keyExtractor={(item) => item.value}
                renderItem={({ item }) => (
                  <CurrencyItem
                    title={item.label}
                    subtitle={item.subtitle}
                    value={item.value}
                    onPress={() => {
                      onCurrencyChange(item.value);
                      setIsOpen(false);
                    }}
                  />
                )}
                ItemSeparatorComponent={() => (
                  <Box className="mx-4">
                    <Divider className="border-secondary-100" />
                  </Box>
                )}
              />
            </RadioGroup>
          </VStack>
          <Box className="w-full p-4">
            <HStack className="gap-x-2">
              <FormButton
                className="flex-1"
                text="Save Currency"
                disabled={!selected}
                onPress={() => {
                  onCurrencyChange(selected);
                  setIsOpen(false);
                }}
              />
            </HStack>
          </Box>
        </ActionsheetContent>
      </Actionsheet>
    </Fragment>
  );
};

function CurrencyItem({
  title,
  subtitle,
  value,
  onPress
}: {
  title: string;
  subtitle: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Radio
      key={value}
      value={value}
      size="lg"
      className="justify-between px-4"
      onPress={onPress}
    >
      <HStack className="flex-1 items-center gap-x-2">
        <VStack className="gap-y-4 py-4">
          <VStack>
            <Text className="text-lg">{title}</Text>
            <Text className="text text-secondary-950">{subtitle}</Text>
          </VStack>
        </VStack>
      </HStack>
      <RadioIndicator>
        <RadioIcon as={CircleIcon} />
      </RadioIndicator>
    </Radio>
  );
}

export default CurrencySelection;
