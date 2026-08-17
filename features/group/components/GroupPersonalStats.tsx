import CategoryGauge from "@/components/CategoryGauge";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import {
  expenseCategoryColor,
  expenseCategoryMeta
} from "@/features/expense/components/CategorySheet";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import CombinedSpendSection from "@/features/group/components/CombinedSpendSection";
import { ExpensePreview, MemberSplit } from "@/types/expenses";
import { isConverted, useConverter } from "@/utils/fx";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { useMemo } from "react";

/**
 * "Your Activity" — the current user's personal figures for the You view of the
 * Stats tab, leading with their own share / paid / net for the selected date
 * range rather than making them hunt for their "(You)" row in Member Breakdown.
 *
 * Built the same way as the Total Group Spendings card — one card, category
 * gauge on top, supporting figures underneath — so both views of the Stats tab
 * read as one system, and the book Stats tab with them. Foreign spend is
 * converted into the group's currency at display time, matching the rest of the
 * tab: your share of a ¥ dinner is money you owe this group, so leaving it out
 * would understate every figure here.
 */
export default function GroupPersonalStats({
  expenses,
  splits,
  loading,
  userId,
  groupId,
  groupCategory,
  cutoff,
  until,
  primaryCurrency = "PHP"
}: {
  /** Already date-range-filtered expenses from the Stats tab. */
  expenses: ExpensePreview[];
  /** Member splits for the filtered expenses, fetched once by the Stats tab. */
  splits: MemberSplit[];
  loading: boolean;
  userId: string;
  groupId: string;
  /** Drives the combined total's wording ("Trip total" vs "Household total"). */
  groupCategory?: string;
  /** The Stats tab's active range, so the linked book's half of the roll-up is
   *  measured over exactly the same window as the group's half. */
  cutoff: Date | null;
  until: Date | null;
  primaryCurrency?: string;
}) {
  const convert = useConverter(primaryCurrency);

  // Only finalized expenses carry splits/payers; drafts aren't real spending.
  const finalized = useMemo(
    () => expenses.filter((e) => !e.is_draft),
    [expenses]
  );

  // What you actually consumed — your share of the splits, the true cost of
  // being in this group regardless of who fronted the cash. Converted into the
  // group currency; a split we hold no rate for drops out rather than counting
  // as zero.
  // Each figure carries its OWN "≈", set only by the money that figure is built
  // from: your share can be pure pesos in a group that had a yen dinner someone
  // else was in, and marking it approximate then would be wrong.
  const { yourShare, shareApprox } = useMemo(() => {
    let total = 0;
    let approx = false;
    splits
      .filter((s) => s.member.id === userId)
      .forEach((s) => {
        const value = convert(s.amount, s.currency);
        if (value === null) return;
        total += value;
        approx ||= isConverted(s.amount, s.currency, primaryCurrency);
      });
    return { yourShare: total, shareApprox: approx };
  }, [splits, userId, convert, primaryCurrency]);

  // What you fronted as a payer, plus how many expenses you paid toward.
  const { youPaid, paidCount, paidApprox } = useMemo(() => {
    let paid = 0;
    let count = 0;
    let approx = false;
    finalized.forEach((expense) => {
      const yourPortions = expense.payer_list.filter(
        (p) => p.payer.id === userId
      );
      if (yourPortions.length === 0) return;
      count += 1;
      yourPortions.forEach((p) => {
        const value = convert(p.amount, p.currency);
        if (value === null) return;
        paid += value;
        approx ||= isConverted(p.amount, p.currency, primaryCurrency);
      });
    });
    return { youPaid: paid, paidCount: count, paidApprox: approx };
  }, [finalized, userId, convert, primaryCurrency]);

  const yourNet = youPaid - yourShare;
  // Net is built from both sides, so either one being converted makes it so.
  const netApprox = shareApprox || paidApprox;

  // Your spending broken down by category, ready for the gauge — splits don't
  // carry the category, so map each split back to its parent expense's. Largest
  // first, each with its share of `yourShare` (the same filter builds both, so
  // the slices always sum back to the figure in the middle of the gauge).
  const categorySlices = useMemo(() => {
    const categoryByExpenseId = new Map(
      finalized.map((e) => [e.id, e.category || "other"])
    );

    const byCategory = new Map<string, { amount: number; approx: boolean }>();
    let total = 0;
    splits
      .filter((s) => s.member.id === userId)
      .forEach((s) => {
        const value = convert(s.amount, s.currency);
        if (value === null) return;
        const key = categoryByExpenseId.get(s.expense_id) ?? "other";
        const entry = byCategory.get(key) ?? { amount: 0, approx: false };
        entry.amount += value;
        entry.approx ||= isConverted(s.amount, s.currency, primaryCurrency);
        byCategory.set(key, entry);
        total += value;
      });

    return Array.from(byCategory.entries())
      .map(([category, entry]) => ({
        key: category,
        label: expenseCategoryMeta(category).label,
        color: expenseCategoryColor(category),
        amount: entry.amount,
        approx: entry.approx,
        pct: total > 0 ? (entry.amount / total) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [splits, finalized, userId, convert, primaryCurrency]);

  return (
    /* You Spent — the gauge carries your share AND where it went, with paid/net
       underneath, mirroring the Total Group Spendings card on the Group view. */
    <Card className="rounded-xl bg-secondary-100">
      <VStack className="gap-y-4">
        <HStack className="items-center justify-between">
          <Text bold className="text-secondary-950 uppercase text-sm">
            You Spent
          </Text>
          <Text className="text-sm text-secondary-950">{primaryCurrency}</Text>
        </HStack>

        {/* The splits the gauge is built from arrive a beat after the expenses,
            and an all-grey arc reading ₱0.00 is indistinguishable from a real
            empty range — so hold the headline as an em dash until they land. */}
        {loading ? (
          <VStack className="items-center py-8 gap-y-1">
            <Text className="text-sm text-secondary-950">Your share</Text>
            <Text bold className="text-2xl">
              —
            </Text>
          </VStack>
        ) : (
          <CategoryGauge
            slices={categorySlices}
            total={yourShare}
            currency={primaryCurrency}
            label="Your share"
            approx={shareApprox}
          />
        )}

        <Divider />

        {/* Paid vs. net */}
        <HStack className="items-stretch">
          <VStack className="flex-1 gap-y-1">
            <Text className="text-sm text-secondary-950 uppercase">
              You Paid
            </Text>
            <Text
              bold
              className="text-lg"
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {paidApprox ? "≈ " : ""}
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
              numberOfLines={1}
              adjustsFontSizeToFit
              className={cn(
                "text-lg",
                !loading && yourNet < 0 && "text-error-400"
              )}
            >
              {loading
                ? "—"
                : `${netApprox ? "≈ " : ""}${formatAmount(yourNet, primaryCurrency)}`}
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

        {/* Your share here + your own book's spending = what this trip/household
            actually cost you. Renders a link CTA until a book is attached. */}
        <CombinedSpendSection
          groupId={groupId}
          groupCategory={groupCategory}
          targetCurrency={primaryCurrency}
          yourShare={yourShare}
          shareApprox={shareApprox}
          shareLoading={loading}
          cutoff={cutoff}
          until={until}
        />
      </VStack>
    </Card>
  );
}
