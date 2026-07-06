import CurrencyCountButton from "@/components/CurrencyCountButton";
import Icon from "@/components/Icon";
import ListDivider from "@/components/ListDivider";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import { Payment, PaymentPreview } from "@/types/expenses";
import { groupByCurrency } from "@/utils/currency";
import { Fragment, useMemo, useState } from "react";
import { LayoutAnimation } from "react-native";
import SettlementItem from "./SettlementItem";

/**
 * A collapsible boxed group used by the "By Expense" / "By Person" settlement
 * views. The header shows the group name and its total (per-currency), and is
 * pressable to collapse/expand the settlement items rendered with the shared
 * SettlementItem component.
 */
export default function SettlementGroupCard({
  title,
  items,
  onItemPress,
  defaultExpanded = true,
  highlightId = null
}: {
  title: string;
  items: (PaymentPreview | Payment)[];
  onItemPress: (item: PaymentPreview | Payment) => void;
  defaultExpanded?: boolean;
  // Id of a settlement to highlight (deep-linked from a notification).
  highlightId?: string | null;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const totals = useMemo(() => groupByCurrency(items), [items]);
  const primaryTotal = totals[0];

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  return (
    <Box className="rounded-xl border border-secondary-200 overflow-hidden bg-background-0">
      <Pressable onPress={toggle}>
        <HStack className="items-center gap-x-3 p-4 bg-background-50">
          <Text
            className="flex-1 text-base text-secondary-950 uppercase"
            bold
            numberOfLines={1}
          >
            {title}
          </Text>
          <HStack className="items-center gap-x-1">
            <Text className="text-lg" bold>
              {formatAmount(primaryTotal?.amount ?? 0, primaryTotal?.currency)}
            </Text>
            <CurrencyCountButton
              items={totals}
              title={title}
              subtitle="Total per currency"
            />
          </HStack>
          <Icon
            as={expanded ? "expand-less" : "expand-more"}
            className="text-secondary-950"
          />
        </HStack>
      </Pressable>

      {expanded && (
        <VStack>
          {items.map((item, index) => (
            <Fragment key={item.id}>
              {index > 0 && <ListDivider />}
              <SettlementItem
                item={item}
                onPress={onItemPress}
                highlighted={!!highlightId && item.id === highlightId}
              />
            </Fragment>
          ))}
        </VStack>
      )}
    </Box>
  );
}
