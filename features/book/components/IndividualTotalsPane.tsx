import CurrencyCountButton from "@/components/CurrencyCountButton";
import HeroAmount from "@/components/HeroAmount";
import HeroColumn from "@/components/HeroColumn";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { AmountTextSize } from "@/features/expense/utils/amountTextSize";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import { PersonalOverview } from "@/types/books";
import { BASE_CURRENCY, useConvertedTotal } from "@/utils/fx";
import { CircleCheck, Clock } from "lucide-react-native";
import { useMemo } from "react";

/** Shares the balance page's headline and two-column layout in the hero pager. */
export default function IndividualTotalsPane({
  overview,
  isLoading,
  amountSize
}: {
  overview: PersonalOverview | null;
  isLoading: boolean;
  amountSize: AmountTextSize;
}) {
  const summary = useIndividualTotalsSummary(overview);
  const unavailable = !overview;

  return (
    <VStack className="gap-y-4">
      <HeroAmount
        label="Individual Totals"
        amountText={unavailable ? "—" : summary.amountText}
        amountSize={amountSize}
        currency={BASE_CURRENCY}
        tone="onColor"
        isLoading={isLoading && unavailable}
        amountClassName="text-white"
        chip={
          <CurrencyCountButton
            items={summary.totalItems}
            title="Individual Totals"
            subtitle="All recorded Individual expenses, by currency"
            convertTo={BASE_CURRENCY}
            totalLabel="Total expenses"
          />
        }
      />

      <Divider className="bg-white/20" />

      <HStack className="items-stretch">
        <HeroColumn
          icon={<CircleCheck size={14} color="#fff" />}
          label="Paid"
          valueText={unavailable ? "—" : summary.paidText}
          isLoading={isLoading && unavailable}
          chip={
            <CurrencyCountButton
              items={summary.paidItems}
              title="Paid"
              subtitle="Paid expenses across all Individual entries, by currency"
              convertTo={BASE_CURRENCY}
              totalLabel="Total paid"
            />
          }
        />
        <Divider orientation="vertical" className="mx-4 bg-white/20" />
        <HeroColumn
          icon={<Clock size={14} color="#fff" />}
          label="Pending"
          valueText={unavailable ? "—" : summary.pendingText}
          isLoading={isLoading && unavailable}
          chip={
            <CurrencyCountButton
              items={summary.pendingItems}
              title="Pending"
              subtitle="Pending expenses across all Individual entries, by currency"
              convertTo={BASE_CURRENCY}
              totalLabel="Total pending"
            />
          }
        />
      </HStack>
    </VStack>
  );
}

/** Shared figures for the hero headline and its compact scroll summary. */
export function useIndividualTotalsSummary(overview: PersonalOverview | null) {
  const items = useMemo(() => {
    const totals = [...(overview?.totals ?? [])].sort((a, b) =>
      a.currency === BASE_CURRENCY ? -1 : b.currency === BASE_CURRENCY ? 1 : 0
    );
    return {
      totalItems: totals.map((t) => ({
        currency: t.currency,
        amount: t.paid + t.pending
      })),
      paidItems: totals.map((t) => ({ currency: t.currency, amount: t.paid })),
      pendingItems: totals.map((t) => ({
        currency: t.currency,
        amount: t.pending
      }))
    };
  }, [overview]);

  const total = useConvertedTotal(items.totalItems, BASE_CURRENCY);
  const paid = useConvertedTotal(items.paidItems, BASE_CURRENCY);
  const pending = useConvertedTotal(items.pendingItems, BASE_CURRENCY);
  const amountText = (summary: typeof total) =>
    `${summary.convertedCurrencies.length > 0 ? "≈ " : ""}${formatAmount(summary.total, BASE_CURRENCY)}`;

  return {
    ...items,
    amountText: amountText(total),
    paidText: amountText(paid),
    pendingText: amountText(pending)
  };
}
