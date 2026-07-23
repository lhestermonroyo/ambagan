import AppAvatar from "@/components/AppAvatar";
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import services from "@/services";
import { ExpensePreview, MemberSplit } from "@/types/expenses";
import { UserPreview } from "@/types/user";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { useEffect, useMemo, useRef, useState } from "react";

type MemberRow = {
  member: UserPreview;
  paid: number;
  share: number;
  net: number;
};

export default function GroupMemberBreakdown({
  expenses,
  userId,
  primaryCurrency = "PHP"
}: {
  /** Already date-range-filtered expenses from the Stats tab. */
  expenses: ExpensePreview[];
  userId: string;
  primaryCurrency?: string;
}) {
  const [splits, setSplits] = useState<MemberSplit[]>([]);
  const [loading, setLoading] = useState(false);

  // Only finalized expenses have splits; drafts carry an amount but no shares.
  const finalized = useMemo(
    () => expenses.filter((e) => !e.is_draft),
    [expenses]
  );

  // Stable key so the fetch only re-runs when the actual set of expenses (i.e.
  // the selected date range) changes, not on every render.
  const expenseIdsKey = useMemo(
    () =>
      finalized
        .map((e) => e.id)
        .sort()
        .join(","),
    [finalized]
  );

  const requestIdRef = useRef(0);

  useEffect(() => {
    const ids = expenseIdsKey ? expenseIdsKey.split(",") : [];
    if (ids.length === 0) {
      setSplits([]);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    services.expense
      .getMemberSplitsByExpenseIds(ids)
      .then((data) => {
        // Ignore a stale response that resolves after a newer range change.
        if (requestId === requestIdRef.current) setSplits(data);
      })
      .catch(() => {
        if (requestId === requestIdRef.current) setSplits([]);
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });
  }, [expenseIdsKey]);

  // Per-member paid vs. share, scoped to the primary currency. Amounts in other
  // currencies are excluded here to keep each member's net meaningful — mixing
  // currencies into one figure would be misleading. (Free-tier groups are
  // PHP-only, so this only trims the rare multi-currency traveler group.)
  const rows = useMemo<MemberRow[]>(() => {
    const map = new Map<string, MemberRow>();

    const ensure = (member: UserPreview) => {
      let row = map.get(member.id);
      if (!row) {
        row = { member, paid: 0, share: 0, net: 0 };
        map.set(member.id, row);
      }
      return row;
    };

    finalized.forEach((expense) => {
      expense.payer_list.forEach((p) => {
        if (p.currency !== primaryCurrency) return;
        ensure(p.payer).paid += p.amount;
      });
    });

    splits.forEach((split) => {
      if (split.currency !== primaryCurrency) return;
      ensure(split.member).share += split.amount;
    });

    return Array.from(map.values())
      .map((row) => ({ ...row, net: row.paid - row.share }))
      .filter((row) => row.paid > 0 || row.share > 0)
      .sort((a, b) => b.paid - a.paid);
  }, [finalized, splits, primaryCurrency]);

  const totalPaid = useMemo(
    () => rows.reduce((sum, row) => sum + row.paid, 0),
    [rows]
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
                        Paid {formatAmount(row.paid, primaryCurrency)} · Share{" "}
                        {formatAmount(row.share, primaryCurrency)}
                      </Text>
                    </VStack>
                    <VStack className="items-end">
                      <Text className="text-xs text-secondary-950 uppercase">
                        Net
                      </Text>
                      <Text className={cn("text-lg", netColor)}>
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
