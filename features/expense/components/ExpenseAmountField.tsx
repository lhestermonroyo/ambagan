import CurrencyCountButton from "@/components/CurrencyCountButton";
import CurrencySelection from "@/components/CurrencySelection";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { currencies } from "@/utils/constants";
import { BASE_CURRENCY, useConverter } from "@/utils/fx";
import { getPrimaryHex } from "@/utils/getColorHex";
import { useState } from "react";
import { TextInput, useColorScheme } from "react-native";
import { formatAmount } from "../utils/formatAmount";

const BASE_FONT_SIZE = 56;

/** A currency pill above a single-line amount, measured in the actual font. */
export default function ExpenseAmountField({
  value,
  onChangeText,
  currency,
  onCurrencyChange,
  locked,
  onLockedPress,
  errorMessage,
  reportingCurrency = BASE_CURRENCY
}: {
  value: string;
  onChangeText: (value: string) => void;
  currency: string;
  onCurrencyChange: (currency: string) => void;
  locked: boolean;
  onLockedPress: () => void;
  errorMessage?: string;
  reportingCurrency?: string;
}) {
  const scheme = useColorScheme() ?? "light";
  const [inputWidth, setInputWidth] = useState(240);
  const [measurement, setMeasurement] = useState({ value: "", width: 0 });
  // Group only the whole-number part, preserving typed decimals and a trailing
  // decimal point. The parent keeps the unformatted value for calculations.
  const [whole, ...fraction] = value.split(".");
  const formattedValue = [
    whole.replace(/\B(?=(\d{3})+(?!\d))/g, ","),
    ...fraction
  ].join(".");
  const displayValue = formattedValue || "0";
  // Estimate until native text layout reports this value's exact width. Keep
  // room for the caret so a long amount stays visible while it is being typed.
  const naturalWidth =
    measurement.value === displayValue && measurement.width > 0
      ? measurement.width
      : displayValue.length * BASE_FONT_SIZE * 0.65;
  const fontSize = Math.min(
    BASE_FONT_SIZE,
    (Math.max(inputWidth - 16, 1) / naturalWidth) * BASE_FONT_SIZE
  );
  const convert = useConverter(reportingCurrency);
  const amount = Number.parseFloat(value) || 0;
  const converted = convert(amount, currency);
  const showConversion = currency !== reportingCurrency;
  const symbol = currencies.find((c) => c.value === currency)?.sign ?? currency;

  return (
    <VStack className="items-center gap-y-2 py-4">
      <CurrencySelection
        variant="pill"
        currency={currency}
        onCurrencyChange={onCurrencyChange}
        locked={locked}
        onLockedPress={onLockedPress}
      />
      <HStack className="w-full items-center gap-x-2">
        <Text
          className="text-3xl text-primary-500 w-10 text-center"
          numberOfLines={1}
        >
          {symbol}
        </Text>
        <Box
          className="flex-1 min-w-0 overflow-hidden"
          onLayout={(event) => setInputWidth(event.nativeEvent.layout.width)}
        >
          <TextInput
            accessibilityLabel="Amount"
            value={formattedValue}
            onChangeText={(text) => onChangeText(text.replace(/,/g, ""))}
            placeholder="0"
            placeholderTextColor={scheme === "dark" ? "#F5F5F5" : "#262626"}
            keyboardType="decimal-pad"
            returnKeyType="done"
            autoCorrect={false}
            autoCapitalize="none"
            selectionColor={getPrimaryHex("text-primary-500", scheme)}
            className="text-typography-950 w-full font-semibold"
            style={{
              fontFamily: "GoogleSans-SemiBold",
              fontSize,
              height: 80,
              padding: 0,
              textAlign: "center"
            }}
          />
          <Text
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            style={{
              position: "absolute",
              width: 10000,
              opacity: 0,
              fontFamily: "GoogleSans-SemiBold",
              fontWeight: "600",
              fontSize: BASE_FONT_SIZE
            }}
            onTextLayout={(event) => {
              const width = event.nativeEvent.lines[0]?.width ?? 0;
              setMeasurement((prev) =>
                prev.value === displayValue && prev.width === width
                  ? prev
                  : { value: displayValue, width }
              );
            }}
          >
            {displayValue}
          </Text>
        </Box>
        <Box className="w-10" />
      </HStack>
      <HStack className="min-h-5 items-center justify-center gap-x-2">
        {showConversion && (
          <>
            <Text className="text-xs text-secondary-950">
              {converted === null
                ? "Conversion rate unavailable"
                : `Approx. ${formatAmount(converted, reportingCurrency)} ${reportingCurrency}`}
            </Text>
            <CurrencyCountButton
              items={[{ currency, amount }]}
              title="Approximate value"
              subtitle="Original amount and reporting currency conversion"
              convertTo={reportingCurrency}
              totalLabel="Approximate total"
            />
          </>
        )}
      </HStack>
      {!!errorMessage && (
        <Text className="text-sm text-error-500">{errorMessage}</Text>
      )}
    </VStack>
  );
}
