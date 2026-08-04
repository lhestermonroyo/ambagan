import Icon from "@/components/Icon";
import ListDivider from "@/components/ListDivider";
import { currencies } from "@/utils/constants";
import { getSecondaryHex } from "@/utils/getColorHex";
import { CircleIcon, Lock } from "lucide-react-native";
import { Fragment, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AppSheet from "./AppSheet";
import PressableListItem from "./PressableListItem";
import { FlatList } from "./ui/flat-list";
import { HStack } from "./ui/hstack";
import { Pressable } from "./ui/pressable";
import { Radio, RadioGroup, RadioIcon, RadioIndicator } from "./ui/radio";
import { Text } from "./ui/text";
import { VStack } from "./ui/vstack";

/**
 * The `currency` value that stands for "don't pin one — follow the other
 * setting" when the sheet is given a {@link CurrencySelectionSheet} `sameAs`
 * option. Empty string rather than null so it can sit in the RadioGroup's
 * value alongside real currency codes, which never collide with it.
 */
export const CURRENCY_SAME_AS = "";

export const CurrencySelectionSheet = ({
  isOpen,
  currency,
  onClose,
  onCurrencyChange,
  title = "Select Currency",
  // Disables selection (e.g. offline, when the change can't be saved to the DB).
  disabled = false,
  sameAs
}: {
  isOpen: boolean;
  currency: string;
  onClose: () => void;
  onCurrencyChange: (currency: string) => void;
  title?: string;
  disabled?: boolean;
  /**
   * Adds a leading "follow the other setting" option above the currency list,
   * which emits {@link CURRENCY_SAME_AS}. For settings whose real default is
   * "inherit" rather than a specific currency — pinning a code there would
   * silently stop tracking the thing it inherits from.
   */
  sameAs?: { label: string; subtitle: string };
}) => {
  return (
    <AppSheet
      isOpen={isOpen}
      onClose={onClose}
      contentClassName="w-full flex-1 gap-y-4"
    >
      <Pressable onPress={onClose}>
        <HStack className="p-4 items-center">
          <Icon as="arrow-back-ios" className="text-secondary-950" />
          <Text bold className="text-xl">
            {title}
          </Text>
        </HStack>
      </Pressable>
      {disabled && (
        <VStack className="px-4">
          <Text className="text-sm text-secondary-950">
            You're offline — changing this needs a connection.
          </Text>
        </VStack>
      )}
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
          // The inherit option leads the list rather than sitting inside it:
          // it's the default, and it isn't a currency, so it doesn't belong in
          // the alphabetical run of codes below.
          ListHeaderComponent={
            sameAs ? (
              <Fragment>
                <CurrencyItem
                  title={sameAs.label}
                  subtitle={sameAs.subtitle}
                  value={CURRENCY_SAME_AS}
                />
                <ListDivider />
              </Fragment>
            ) : null
          }
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
    </AppSheet>
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
        className="h-14 border border-background-200 items-center justify-center px-2 py-2 rounded-lg"
      >
        <HStack className="items-center justify-center gap-x-2">
          <Text className="font-semibold">{currencyLabel}</Text>
          {locked ? (
            <Lock
              size={18}
              color={getSecondaryHex("text-secondary-950", colorScheme)}
            />
          ) : (
            <Icon as="unfold-more" className="text-sm text-secondary-950" />
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
    <Radio key={value} value={value} size="md" className="justify-between px-4">
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
