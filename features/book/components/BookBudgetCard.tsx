import ApproxRateNote from "@/components/ApproxRateNote";
import { type CurrencyAmount } from "@/components/CurrencyBreakdownSheet";
import CurrencyCountButton from "@/components/CurrencyCountButton";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import CurrencyAmountDisplay from "@/features/expense/components/CurrencyAmountDisplay";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import { Book, PersonalBookTotal } from "@/types/books";
import { getRate, useFxRates } from "@/utils/fx";
import { useMemo } from "react";

/**
 * Progress against a book's spending cap, in the book's own currency. Spend in
 * any OTHER currency is folded in at an approximate rate (see utils/fx) so a
 * mixed PHP/JPY trip book can't report a ¥42,000 month as 0% of budget used —
 * a budget bar has to be a single number. The Paid/Pending stats in the footer
 * convert on the same terms: they answer the same "how much have I spent"
 * question as the bar, so showing them in one currency while the bar totals in
 * another would put two different answers on one card. Money that must be exact
 * — balances and settlements — stays split per-currency and never converts.
 *
 * The mixed-currency disclosure is deliberately ONE chip and ONE caption. An
 * earlier version spelled out what was included, what it converted to and what
 * had no rate as three more full-width rows, in the same label/value grammar as
 * the budget's own numbers — which left nothing on the card reading as the
 * answer. The working now lives in the sheet behind the chip, where it can add
 * up to the headline figure properly; only the rate vintage stays on the card,
 * because the feed's attribution is a licence condition and can't hide a tap
 * away.
 *
 * The bar itself is a plain paid run plus a neutral pending segment stacked on
 * top, so an about-to-be-blown budget is visible before the money leaves.
 * Category colors are NOT here — that story is the Stats tab's gauge, which has
 * the room to label it.
 *
 * When paid/pending breakdowns are passed in, the card also carries the book's
 * total spent stats in a divided-off footer.
 *
 * Renders nothing when the book has no budget set.
 */
export default function BookBudgetCard({
  book,
  totals,
  paidByCurrency,
  pendingByCurrency,
  primaryCurrency = book.currency
}: {
  book: Book;
  /** Spend for the budget's window — this month's for 'monthly', all-time for 'total'. */
  totals: PersonalBookTotal[];
  /** Book-wide paid spend per currency, shown in the card's stats footer. */
  paidByCurrency?: { currency: string; amount: number }[];
  /** Book-wide pending spend per currency, shown in the card's stats footer. */
  pendingByCurrency?: { currency: string; amount: number }[];
  primaryCurrency?: string;
}) {
  const budget = book.budget;
  const currency = book.currency;
  const isMonthly = book.budget_period !== "total";
  // Re-renders when a rate refresh lands, so the bar and its vintage caption
  // move together.
  const fx = useFxRates();

  const { paid, pending, rows, convertedCurrencies, hasUncounted } =
    useMemo(() => {
      let paid = 0;
      let pending = 0;
      const convertedCurrencies: string[] = [];
      let hasUncounted = false;

      // One row per currency with paid spend, so the sheet behind the chip adds
      // up to exactly the headline figure. Pending is left out of it on purpose
      // — the headline is paid spend, and pending's own per-currency split is a
      // tap away in the Pending stat below.
      const priced: { row: CurrencyAmount; value: number }[] = [];

      for (const t of totals) {
        const rate = getRate(fx, t.currency, currency);

        // No rate for this currency — it can't join the bar. Surfaced rather
        // than silently dropped: it still gets a row (marked "Not counted" by
        // the sheet) and raises the flag for the caption below.
        if (rate === null) {
          if (t.paid > 0) {
            priced.push({
              row: { currency: t.currency, amount: t.paid },
              value: -1
            });
            hasUncounted = true;
          }
          continue;
        }

        paid += t.paid * rate;
        pending += t.pending * rate;

        if (t.currency !== currency && (t.paid > 0 || t.pending > 0)) {
          convertedCurrencies.push(t.currency);
        }
        if (t.paid > 0) {
          priced.push({
            row: { currency: t.currency, amount: t.paid },
            value: t.paid * rate
          });
        }
      }

      // The book's own currency leads — it's the one the budget is set in —
      // then the rest by how much they actually contributed.
      const rows = priced
        .sort((a, b) => {
          if (a.row.currency === currency) return -1;
          if (b.row.currency === currency) return 1;
          return b.value - a.value;
        })
        .map((p) => p.row);

      return { paid, pending, rows, convertedCurrencies, hasUncounted };
    }, [totals, currency, fx]);

  // The footer's stats are book-wide while the bar covers only the budget's
  // window, so a currency can be converted down there and absent up here (last
  // month's yen on a monthly budget). The card keeps ONE rate caption, so it has
  // to be told about both sets or it would quote a vintage for figures it didn't
  // cover.
  const noteCurrencies = useMemo(() => {
    const seen = new Set(convertedCurrencies);
    for (const item of [
      ...(paidByCurrency ?? []),
      ...(pendingByCurrency ?? [])
    ]) {
      if (
        item.currency !== currency &&
        item.amount !== 0 &&
        getRate(fx, item.currency, currency) !== null
      ) {
        seen.add(item.currency);
      }
    }
    return Array.from(seen);
  }, [convertedCurrencies, paidByCurrency, pendingByCurrency, currency, fx]);

  if (budget == null || budget <= 0) return null;

  const remaining = budget - paid;
  const isOver = remaining < 0;
  // Pending is only "at risk" up to what's still left — anything beyond the cap
  // is already over-budget and shown by the over-budget state instead.
  const atRisk = Math.min(pending, Math.max(remaining, 0));

  const paidPct = Math.min((paid / budget) * 100, 100);
  const pendingPct = Math.min((atRisk / budget) * 100, 100 - paidPct);
  const isApprox = convertedCurrencies.length > 0;

  return (
    <VStack className="mx-4 p-4 rounded-xl bg-secondary-100 gap-y-4">
      <HStack className="items-center justify-between">
        <Text bold className="text-sm text-secondary-950 uppercase">
          {isMonthly ? "Monthly budget" : "Total budget"}
        </Text>
        <Text className="text-sm text-secondary-950">
          {isMonthly ? monthLabel() : "Whole book"}
        </Text>
      </HStack>

      <VStack className="gap-y-2">
        {/* The chip rides with the headline rather than getting a row of its
            own: it exists to answer "why is there a ≈ on this number", and
            that question is asked where the number is. It hides itself on a
            single-currency book, so the common case is one clean line. */}
        <HStack className="items-end justify-between gap-x-2">
          <HStack className="items-center gap-x-2 flex-shrink">
            <Text
              bold
              className="text-2xl"
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {isApprox ? "≈ " : ""}
              {formatAmount(paid, currency)}
            </Text>
            <CurrencyCountButton
              items={rows}
              title="Spend by currency"
              subtitle={`Counted toward this ${isMonthly ? "month's" : ""} budget`}
              convertTo={currency}
              totalLabel="Total spent"
            />
          </HStack>
          <Text className="text-secondary-950">
            of {formatAmount(budget, currency)}
          </Text>
        </HStack>

        {/* Paid fills the bar, pending stacks after it in neutral gray. Over
            budget the run turns red and the copy below follows. */}
        <Box className="h-2 rounded-full bg-secondary-200 overflow-hidden">
          <HStack className="h-full">
            <Box
              className={`h-full ${isOver ? "bg-error-600" : "bg-primary-500"}`}
              style={{ width: `${paidPct}%` }}
            />
            {pendingPct > 0 && (
              <Box
                className="h-full bg-secondary-400"
                style={{ width: `${pendingPct}%` }}
              />
            )}
          </HStack>
        </Box>

        <HStack className="items-center justify-between">
          <Text
            className={`text-sm ${isOver ? "text-error-600" : "text-secondary-950"}`}
          >
            {isOver
              ? `${formatAmount(Math.abs(remaining), currency)} over budget`
              : `${formatAmount(remaining, currency)} left`}
          </Text>
          <Text className="text-sm text-secondary-950">
            {Math.round((paid / budget) * 100)}%
          </Text>
        </HStack>

        {/* Two states that the bar itself can't show. Both are exceptions, so
            they're styled as flags rather than as another pair of body rows. */}
        {hasUncounted && (
          <Text className="text-xs text-warning-700">
            Some spend has no conversion rate and isn&apos;t counted here.
          </Text>
        )}
        {atRisk > 0 && pending > remaining && !isOver && (
          <Text className="text-xs text-warning-700">
            Pending bills are enough to go over budget.
          </Text>
        )}
      </VStack>

      {/* Book-wide paid/pending stats, divided off from the budget above —
          these cover the whole book, not just the budget's window. */}
      {paidByCurrency && pendingByCurrency && (
        <VStack className="gap-y-4">
          <Divider />
          <HStack className="items-stretch">
            <VStack className="flex-1 gap-y-1 pr-3">
              <Text className="text-sm text-secondary-950 uppercase">Paid</Text>
              <CurrencyAmountDisplay
                items={paidByCurrency}
                label="Paid"
                subtitle="Settled spend, by currency"
                primaryCurrency={primaryCurrency}
                amountClassName="text-background-950"
                fitAmount
                convertTo={currency}
                totalLabel="Total paid"
              />
            </VStack>
            <Divider orientation="vertical" className="mx-4" />
            <VStack className="flex-1 gap-y-1 pl-3">
              <Text className="text-sm text-secondary-950 uppercase">
                Pending
              </Text>
              <CurrencyAmountDisplay
                items={pendingByCurrency}
                label="Pending"
                subtitle="Upcoming spend, by currency"
                primaryCurrency={primaryCurrency}
                amountClassName="text-background-950"
                fitAmount
                convertTo={currency}
                totalLabel="Total pending"
              />
            </VStack>
          </HStack>
        </VStack>
      )}

      {/* The rate vintage matters as much as the "approximate" — it tells
          someone two years from now how much to trust the number — and the
          attribution link is a licence condition of the rate feed, so this one
          caption stays on the card even though the working moved into the
          sheets. It closes the card rather than sitting under the bar because
          it now covers the footer's converted totals too. Renders nothing on a
          single-currency book. */}
      <ApproxRateNote currencies={noteCurrencies} />
    </VStack>
  );
}

/** "July · 18 days left" — the window a monthly budget is measured over. */
function monthLabel(): string {
  const now = new Date();
  const month = now.toLocaleString("en-US", { month: "long" });
  const daysInMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0
  ).getDate();
  const left = daysInMonth - now.getDate();
  if (left === 0) return `${month} · last day`;
  return `${month} · ${left} day${left === 1 ? "" : "s"} left`;
}
