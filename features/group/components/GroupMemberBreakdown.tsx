import AppAvatar from "@/components/AppAvatar";
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import { ExpensePreview, MemberSplit } from "@/types/expenses";
import { UserPreview } from "@/types/user";
import { isConverted, useConverter } from "@/utils/fx";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { useMemo } from "react";

type MemberRow = {
  member: UserPreview;
  paid: number;
  share: number;
  net: number;
  /** Whether THIS member's figures folded in a foreign currency. Per row, not
   *  per card: in a mostly-peso group only the one member who paid for the yen
   *  dinner is showing an estimate. */
  approx: boolean;
};

export default function GroupMemberBreakdown({
  expenses,
  splits,
  loading,
  userId,
  primaryCurrency = "PHP",
}: {
  /** Already date-range-filtered expenses from the Stats tab. */
  expenses: ExpensePreview[];
  /** Member splits for the filtered expenses, fetched once by the Stats tab. */
  splits: MemberSplit[];
  loading: boolean;
  userId: string;
  primaryCurrency?: string;
}) {
  const convert = useConverter(primaryCurrency);

  // Only finalized expenses have splits; drafts carry an amount but no shares.
  const finalized = useMemo(
    () => expenses.filter((e) => !e.is_draft),
    [expenses],
  );

  // Per-member paid vs. share, with foreign amounts converted into the group's
  // currency so a member who only ever fronted yen still shows up here with a
  // real net. Anything we hold no rate for is left out rather than counted as
  // zero — an understated row beats a wrong one.
  const rows = useMemo<MemberRow[]>(() => {
    const map = new Map<string, MemberRow>();

    const ensure = (member: UserPreview) => {
      let row = map.get(member.id);
      if (!row) {
        row = { member, paid: 0, share: 0, net: 0, approx: false };
        map.set(member.id, row);
      }
      return row;
    };

    finalized.forEach((expense) => {
      expense.payer_list.forEach((p) => {
        const value = convert(p.amount, p.currency);
        if (value === null) return;
        const row = ensure(p.payer);
        row.paid += value;
        row.approx ||= isConverted(p.amount, p.currency, primaryCurrency);
      });
    });

    splits.forEach((split) => {
      const value = convert(split.amount, split.currency);
      if (value === null) return;
      const row = ensure(split.member);
      row.share += value;
      row.approx ||= isConverted(split.amount, split.currency, primaryCurrency);
    });

    return Array.from(map.values())
      .map((row) => ({ ...row, net: row.paid - row.share }))
      .filter((row) => row.paid > 0 || row.share > 0)
      .sort((a, b) => b.paid - a.paid);
  }, [finalized, splits, convert, primaryCurrency]);

  const totalPaid = useMemo(
    () => rows.reduce((sum, row) => sum + row.paid, 0),
    [rows],
  );

  if (!loading && rows.length === 0) return null;

  return (
    <Card className="rounded-xl bg-secondary-100">
      <VStack className="gap-y-4">
        <VStack>
          <Text bold className="text-secondary-950 uppercase text-sm">
            Member Breakdown
          </Text>
          <Text className="text-sm text-secondary-950">
            Who fronted the cash vs. their share of the total.
          </Text>
        </VStack>

        {loading && rows.length === 0 ? (
          <Text className="text-secondary-950">—</Text>
        ) : (
          <VStack className="gap-y-4">
            {rows.map((row) => {
              const isYou = row.member.id === userId;
              const name = `${row.member.first_name} ${row.member.last_name}${isYou ? " (You)" : ""}`;
              const pct =
                totalPaid > 0
                  ? Math.max(2, Math.round((row.paid / totalPaid) * 100))
                  : 0;
              const netColor = row.net < 0 && "text-error-400";
              // All three of this row's figures come from the same money, so
              // they're approximate together or not at all.
              const approxMark = row.approx ? "≈ " : "";

              return (
                <VStack key={row.member.id} className="gap-y-2">
                  <HStack className="items-center gap-x-3">
                    <AppAvatar
                      size="sm"
                      name={name}
                      uri={row.member.avatar || undefined}
                      isPlaceholder={row.member.is_placeholder}
                    />
                    <VStack className="flex-1">
                      <Text numberOfLines={1}>{name}</Text>
                      <Text className="text-sm text-secondary-950">
                        Paid {approxMark}
                        {formatAmount(row.paid, primaryCurrency)} · Share{" "}
                        {approxMark}
                        {formatAmount(row.share, primaryCurrency)}
                      </Text>
                    </VStack>
                    <VStack className="items-end">
                      <Text className="text-xs text-secondary-950 uppercase">
                        Net
                      </Text>
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        className={cn("text-lg font-medium", netColor)}
                      >
                        {approxMark}
                        {formatAmount(row.net, primaryCurrency)}
                      </Text>
                    </VStack>
                  </HStack>
                  {/* Share of total spending fronted by this member. */}
                  <Box className="h-1.5 rounded-full bg-secondary-200 overflow-hidden">
                    <Box
                      className="h-full rounded-full bg-primary-500"
                      style={{ width: `${pct}%` }}
                    />
                  </Box>
                </VStack>
              );
            })}
          </VStack>
        )}
      </VStack>
    </Card>
  );
}
