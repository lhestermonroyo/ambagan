import ListDivider from "@/components/ListDivider";
import { currencies } from "@/utils/constants";
import { getSecondaryHex } from "@/utils/getColorHex";
import { ChevronDown, CircleIcon, Lock } from "lucide-react-native";
import { Fragment, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import PressableListItem from "./PressableListItem";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "./ui/actionsheet";
import { FlatList } from "./ui/flat-list";
import { HStack } from "./ui/hstack";
import { Radio, RadioGroup, RadioIcon, RadioIndicator } from "./ui/radio";
import { Text } from "./ui/text";
import { VStack } from "./ui/vstack";

export const CurrencySelectionSheet = ({
  isOpen,
  currency,
  onClose,
  onCurrencyChange,
  title = "Select Currency",
  // Disables selection (e.g. offline, when the change can't be saved to the DB).
  disabled = false
}: {
  isOpen: boolean;
  currency: string;
  onClose: () => void;
  onCurrencyChange: (currency: string) => void;
  title?: string;
  disabled?: boolean;
}) => {
  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[90]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <VStack className="w-full py-4 flex-1 gap-y-4">
          <VStack className="px-4 gap-y-1">
            <Text bold className="text-xl">
              {title}
            </Text>
            {disabled && (
              <Text className="text-sm text-secondary-950">
                You're offline — changing your default currency needs an
                internet connection.
              </Text>
            )}
          </VStack>
          <RadioGroup
            className="flex-1"
            value={currency}
            isDisabled={disabled}
            onChange={(value) => {
              onCurrencyChange(value);
              onClose();
            }}
          >
            <FlatList
              data={currencies}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <CurrencyItem
                  title={item.label}
                  subtitle={item.subtitle}
                  value={item.value}
                />
              )}
              ItemSeparatorComponent={ListDivider}
            />
          </RadioGroup>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
};

const CurrencySelection = ({
  currency,
  onCurrencyChange,
  locked = false,
  onLockedPress
}: {
  currency: string;
  onCurrencyChange: (currency: string) => void;
  locked?: boolean;
  onLockedPress?: () => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const colorScheme = useColorScheme() ?? "light";

  const currencyLabel = useMemo(() => {
    return currencies.find((c) => c.value === currency)?.label;
  }, [currency]);

  return (
    <Fragment>
      <PressableListItem
        onPress={() => (locked ? onLockedPress?.() : setIsOpen(true))}
        className="border border-secondary-500 items-center justify-center h-full px-2 py-2 rounded-lg"
      >
        <HStack className="items-center justify-center gap-x-1">
          <Text className="font-semibold">{currencyLabel}</Text>
          {locked ? (
            <Lock
              size={16}
              color={getSecondaryHex("text-secondary-950", colorScheme)}
            />
          ) : (
            <ChevronDown
              size={18}
              color={getSecondaryHex("text-secondary-950", colorScheme)}
            />
          )}
        </HStack>
      </PressableListItem>
      {!locked && (
        <CurrencySelectionSheet
          isOpen={isOpen}
          currency={currency}
          onClose={() => setIsOpen(false)}
          onCurrencyChange={onCurrencyChange}
        />
      )}
    </Fragment>
  );
};

function CurrencyItem({
  title,
  subtitle,
  value
}: {
  title: string;
  subtitle: string;
  value: string;
}) {
  return (
    <Radio key={value} value={value} size="lg" className="justify-between px-4">
      <HStack className="flex-1 items-center gap-x-2">
        <VStack className="gap-y-4 py-4">
          <VStack>
            <Text className="text-lg">{title}</Text>
            <Text className="text text-sm text-secondary-950">{subtitle}</Text>
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
