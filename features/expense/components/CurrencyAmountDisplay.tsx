import Icon from "@/components/Icon";
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
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { Fragment, useState } from "react";
import { formatAmount } from "../utils/formatAmount";

export default function CurrencyAmountDisplay({
  items,
  label,
  type = "neutral",
  isLoading = false,
  primaryCurrency = "PHP"
}: {
  items: { currency: string; amount: number }[];
  label: string;
  type?: "pay" | "receive" | "neutral";
  isLoading?: boolean;
  primaryCurrency?: string;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const sorted = [...items].sort((a, b) =>
    a.currency === primaryCurrency ? -1 : b.currency === primaryCurrency ? 1 : 0
  );
  const [primary, ...secondary] = sorted;

  const amountColor = type === "pay" ? "text-error-400" : undefined;

  if (isLoading) {
    return (
      <Text bold className={cn("text-2xl", amountColor)}>
        -
      </Text>
    );
  }

  return (
    <Fragment>
      <Pressable
        onPress={secondary.length > 0 ? () => setSheetOpen(true) : undefined}
      >
        <HStack className="items-center gap-x-2">
          <Text bold className={cn("text-2xl", amountColor)}>
            {formatAmount(primary?.amount ?? 0, primary?.currency ?? primaryCurrency)}
          </Text>
          {secondary.length > 0 && (
            <HStack className="items-center">
              <Box className="bg-primary-400 rounded-full h-5 w-5 flex items-center justify-center">
                <Text className="text-background-0 text-xs font-semibold">
                  +{secondary.length}
                </Text>
              </Box>
              <Icon as="chevron-right" className="text-secondary-950" />
            </HStack>
          )}
        </HStack>
      </Pressable>
      <Actionsheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)}>
        <ActionsheetBackdrop />
        <ActionsheetContent className="p-0">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <VStack className="w-full">
            <VStack className="p-4">
              <Text bold className="text-xl">
                {label}
              </Text>
            </VStack>
            <FlatList
              data={sorted}
              scrollEnabled={false}
              keyExtractor={(item) => item.currency}
              renderItem={({ item: { currency, amount } }) => (
                <HStack className="items-center justify-between p-4">
                  <Text className="text-secondary-950 font-medium text-lg">
                    {currency}
                  </Text>
                  <Text className={cn("text-lg", amountColor)}>
                    {formatAmount(amount, currency)}
                  </Text>
                </HStack>
              )}
              ItemSeparatorComponent={() => (
                <Box className="mx-4">
                  <Divider className="border-secondary-100" />
                </Box>
              )}
            />
          </VStack>
        </ActionsheetContent>
      </Actionsheet>
    </Fragment>
  );
}
