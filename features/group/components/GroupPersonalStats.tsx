import CategoryIcon from "@/components/CategoryIcon";
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { expenseCategoryMeta } from "@/features/expense/components/CategorySheet";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import { ExpensePreview, MemberSplit } from "@/types/expenses";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { useMemo } from "react";

/**
 * "Your Activity" — the current user's personal figures for the You view of the
 * Stats tab, leading with their own share / paid / net for the selected date
 * range rather than making them hunt for their "(You)" row in Member Breakdown.
 *
 * Styled to match the Total Group Spendings card (`bg-secondary-100`, dark text)
 * so both views of the Stats tab read as one system. Everything is scoped to the
 * primary currency, matching the rest of the tab — mixing currencies into one
 * net/total would be misleading, and free-tier groups are PHP-only anyway so
 * this only trims the rare traveler group.
 */
export default function GroupPersonalStats({
  expenses,
  splits,
  loading,
  userId,
  primaryCurrency = "PHP"
}: {
  /** Already date-range-filtered expenses from the Stats tab. */
  expenses: ExpensePreview[];
  /** Member splits for the filtered expenses, fetched once by the Stats tab. */
  splits: MemberSplit[];
  loading: boolean;
  userId: string;
  primaryCurrency?: string;
}) {
  // Only finalized expenses carry splits/payers; drafts aren't real spending.
  const finalized = useMemo(
    () => expenses.filter((e) => !e.is_draft),
    [expenses]
  );

  // What you actually consumed — your share of the splits, the true cost of
  // being in this group regardless of who fronted the cash.
  const yourShare = useMemo(
    () =>
      splits
        .filter((s) => s.member.id === userId && s.currency === primaryCurrency)
        .reduce((sum, s) => sum + s.amount, 0),
    [splits, userId, primaryCurrency]
  );

  // What you fronted as a payer, plus how many expenses you paid toward.
  const { youPaid, paidCount } = useMemo(() => {
    let paid = 0;
    let count = 0;
    finalized.forEach((expense) => {
      const yourPortions = expense.payer_list.filter(
        (p) => p.payer.id === userId && p.currency === primaryCurrency
      );
      if (yourPortions.length > 0) {
        count += 1;
        paid += yourPortions.reduce((sum, p) => sum + p.amount, 0);
      }
    });
    return { youPaid: paid, paidCount: count };
  }, [finalized, userId, primaryCurrency]);

  const yourNet = youPaid - yourShare;

  // Your spending broken down by category — splits don't carry the category, so
  // map each split back to its parent expense's category. Largest first, each
  // with its share of your total.
  const categoryBreakdown = useMemo(() => {
    const categoryByExpenseId = new Map(
      finalized.map((e) => [e.id, e.category || "other"])
    );

    const byCategory = new Map<string, number>();
    let total = 0;
    splits
      .filter((s) => s.member.id === userId && s.currency === primaryCurrency)
      .forEach((s) => {
        const key = categoryByExpenseId.get(s.expense_id) ?? "other";
        byCategory.set(key, (byCategory.get(key) ?? 0) + s.amount);
        total += s.amount;
      });

    return Array.from(byCategory.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        pct: total > 0 ? (amount / total) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [splits, finalized, userId, primaryCurrency]);

  return (
    <>
      {/* You Spent — hero + paid/net, mirroring the Total Group Spendings card */}
      <Card className="rounded-xl bg-secondary-100">
        <VStack className="gap-y-4">
          <VStack className="gap-y-2">
            <Text bold className="text-secondary-950 uppercase text-sm">
              You Spent
            </Text>
            <HStack className="items-end gap-x-2">
              <Text bold className="text-3xl">
                {loading ? "—" : formatAmount(yourShare, primaryCurrency)}
              </Text>
              <Text className="text-secondary-950 text-base pb-1">
                your share
              </Text>
            </HStack>
          </VStack>

          <Divider />

          {/* Paid vs. net */}
          <HStack className="items-stretch">
            <VStack className="flex-1 gap-y-1">
              <Text className="text-sm text-secondary-950 uppercase">
                You Paid
              </Text>
              <Text bold className="text-lg">
                {formatAmount(youPaid, primaryCurrency)}
              </Text>
              <Text className="text-sm text-secondary-950">
                {paidCount} expense{paidCount !== 1 ? "s" : ""}
              </Text>
            </VStack>
            <Divider orientation="vertical" className="mx-4" />
            <VStack className="flex-1 gap-y-1">
              <Text className="text-sm text-secondary-950 uppercase">Net</Text>
              <Text
                bold
                className={cn(
                  "text-lg",
                  !loading && yourNet < 0 && "text-error-400"
                )}
              >
                {loading ? "—" : formatAmount(yourNet, primaryCurrency)}
              </Text>
              <Text className="text-sm text-secondary-950">
                {loading
                  ? " "
                  : yourNet >= 0
                    ? "you fronted extra"
                    : "you owe the group"}
              </Text>
            </VStack>
          </HStack>
        </VStack>
      </Card>

      {/* Your Spending by Category — its own card, mirroring the group tab */}
      {categoryBreakdown.length > 0 && (
        <Card className="rounded-xl bg-secondary-100">
          <VStack className="gap-y-4">
            <VStack>
              <Text bold className="text-secondary-950 uppercase text-sm">
                Your Spending by Category
              </Text>
              <Text className="text-sm text-secondary-950">
                Where your share went in this range.
              </Text>
            </VStack>
            <VStack className="gap-y-4">
              {categoryBreakdown.map((row) => (
                <VStack key={row.category} className="gap-y-2">
                  <HStack className="items-center gap-x-3">
                    <CategoryIcon
                      icon={expenseCategoryMeta(row.category).icon}
                    />
                    <Text className="flex-1 text-base" numberOfLines={1}>
                      {expenseCategoryMeta(row.category).label}
                    </Text>
                    <Text className="text-sm text-secondary-950">
                      {row.pct.toFixed(0)}%
                    </Text>
                    <Text className="text-lg font-medium">
                      {formatAmount(row.amount, primaryCurrency)}
                    </Text>
                  </HStack>
                  <Box className="h-1.5 rounded-full bg-secondary-200 overflow-hidden">
                    <Box
                      className="h-full rounded-full bg-primary-500"
                      style={{ width: `${Math.max(2, row.pct)}%` }}
                    />
                  </Box>
                </VStack>
              ))}
            </VStack>
          </VStack>
        </Card>
      )}
    </>
  );
}
