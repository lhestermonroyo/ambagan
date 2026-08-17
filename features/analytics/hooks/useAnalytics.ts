import {
  expenseCategoryColor,
  expenseCategoryMeta
} from "@/features/expense/components/CategorySheet";
import services from "@/services";
import {
  AnalyticsEntry,
  AnalyticsFetch,
  TopPartner
} from "@/features/analytics/services/analytics.service";
import { GaugeSlice } from "@/components/CategoryGauge";
import {
  BASE_CURRENCY,
  isConverted,
  useConverter,
  useForeignCurrencies
} from "@/utils/fx";
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear
} from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Folds the flat entry list from the analytics service into every figure the
 * screen renders.
 *
 * Currency conversion lives here rather than in the service because rates are a
 * client-side store — see utils/fx. The rule from there applies throughout:
 * money with no rate is DROPPED from a converted figure rather than counted as
 * zero, so a total is understated rather than wrong, and any figure that moved
 * because of a conversion is marked approximate.
 */

/** Which half of the app a figure covers. */
export type AnalyticsScope = "all" | "groups" | "personal";

export type TrendBucket = {
  key: string;
  label: string;
  /** Axis labels are thinned to ~6 per chart; the rest render as bare bars. */
  showLabel: boolean;
  amount: number;
};

export type ContainerSpend = {
  id: string;
  name: string;
  source: "group" | "personal";
  amount: number;
  approx: boolean;
};

export type AnalyticsData = {
  /** Total spend in range — always `share`, never `paid`. See below. */
  total: number;
  totalApprox: boolean;
  /** Null when there's no comparable preceding window (an "All Time" range). */
  previousTotal: number | null;
  /** Percentage change vs `previousTotal`; null when that is null or zero. */
  deltaPct: number | null;
  expenseCount: number;
  average: number;
  perDay: number;
  /** Logged but unpaid personal bills — excluded from `total`. */
  pendingTotal: number;
  pendingApprox: boolean;
  /** What the user fronted on group expenses, and their share of the same. */
  fronted: number;
  frontedShare: number;
  frontingApprox: boolean;
  /** Spend posted by a recurring rule, and its share of `total`. */
  recurringTotal: number;
  recurringPct: number;
  categories: GaugeSlice[];
  byContainer: ContainerSpend[];
  byCurrency: { currency: string; amount: number }[];
  trend: TrendBucket[];
  topExpenses: AnalyticsEntry[];
  partners: TopPartner[];
  /** Foreign currencies actually folded in — drives the rate note. */
  foreignCurrencies: string[];
};

const EMPTY_FETCH: AnalyticsFetch = { current: [], previous: [], partners: [] };

export function useAnalytics(
  userId: string | undefined,
  start: Date | null,
  end: Date | null,
  scope: AnalyticsScope = "all"
): { loading: boolean; error: boolean; data: AnalyticsData | null } {
  const startMs = start?.getTime() ?? null;
  const endMs = end?.getTime() ?? null;
  // Identifies the window a payload belongs to. Storing it WITH the rows (rather
  // than clearing state when the range changes) means a stale response is
  // ignored by construction — there's no render in between where last month's
  // figures sit under this week's heading.
  const key = `${userId ?? ""}|${startMs}|${endMs}`;

  const [state, setState] = useState<{
    key: string;
    result: AnalyticsFetch;
    error: boolean;
  } | null>(null);

  // Guards against a slow early request landing after a faster later one.
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!userId) return;
    const requestId = ++requestIdRef.current;

    services.analytics
      .getAnalyticsData(
        userId,
        startMs === null ? null : new Date(startMs),
        endMs === null ? null : new Date(endMs)
      )
      .then((result) => {
        if (requestId !== requestIdRef.current) return;
        setState({ key, result, error: false });
      })
      .catch((e) => {
        console.error("Failed to fetch analytics:", e);
        if (requestId !== requestIdRef.current) return;
        setState({ key, result: EMPTY_FETCH, error: true });
      });
  }, [userId, startMs, endMs, key]);

  const settled = state?.key === key ? state : null;
  const fetched = settled?.result ?? null;
  const error = settled?.error ?? false;
  // Loading until THIS window's rows have landed, so a range change holds the
  // skeleton instead of briefly showing the previous range's numbers.
  const loading = !!userId && !settled;

  const convert = useConverter(BASE_CURRENCY);

  const scoped = useMemo(
    () => filterByScope(fetched?.current ?? [], scope),
    [fetched, scope]
  );
  const scopedPrevious = useMemo(
    () => filterByScope(fetched?.previous ?? [], scope),
    [fetched, scope]
  );

  // Pending bills aren't money out yet, so every spending figure is built from
  // this subset and pending gets its own line.
  const spend = useMemo(() => scoped.filter((e) => !e.pending), [scoped]);

  const fxItems = useMemo(
    () => spend.map((e) => ({ currency: e.currency, amount: e.share })),
    [spend]
  );
  const foreignCurrencies = useForeignCurrencies(fxItems, BASE_CURRENCY);

  const data = useMemo<AnalyticsData | null>(() => {
    if (!fetched) return null;

    // Priced once, here — every figure below reads from this rather than
    // re-converting, so they can't drift apart. Null means the currency has no
    // rate, and the entry is left out entirely.
    const priced = spend
      .map((entry) => ({
        entry,
        value: convert(entry.share, entry.currency),
        approx: isConverted(entry.share, entry.currency, BASE_CURRENCY)
      }))
      .filter((p): p is { entry: AnalyticsEntry; value: number; approx: boolean } =>
        p.value !== null
      );

    let total = 0;
    let totalApprox = false;
    for (const p of priced) {
      total += p.value;
      totalApprox ||= p.approx;
    }

    // Pending, on the same rules but reported apart.
    let pendingTotal = 0;
    let pendingApprox = false;
    for (const entry of scoped) {
      if (!entry.pending) continue;
      const value = convert(entry.share, entry.currency);
      if (value === null) continue;
      pendingTotal += value;
      pendingApprox ||= isConverted(entry.share, entry.currency, BASE_CURRENCY);
    }

    // Fronting is a group-only idea — a personal expense has no one to front for.
    let fronted = 0;
    let frontedShare = 0;
    let frontingApprox = false;
    for (const entry of scoped) {
      if (entry.source !== "group") continue;
      const paidValue = convert(entry.paid, entry.currency);
      const shareValue = convert(entry.share, entry.currency);
      if (paidValue === null || shareValue === null) continue;
      fronted += paidValue;
      frontedShare += shareValue;
      frontingApprox ||=
        isConverted(entry.paid, entry.currency, BASE_CURRENCY) ||
        isConverted(entry.share, entry.currency, BASE_CURRENCY);
    }

    const recurringTotal = priced
      .filter((p) => p.entry.recurring)
      .reduce((sum, p) => sum + p.value, 0);

    // Categories, largest first, in the shape CategoryGauge wants.
    const categoryMap = new Map<string, { amount: number; approx: boolean }>();
    for (const p of priced) {
      const key = p.entry.category || "general";
      const acc = categoryMap.get(key) ?? { amount: 0, approx: false };
      acc.amount += p.value;
      acc.approx ||= p.approx;
      categoryMap.set(key, acc);
    }
    const categories: GaugeSlice[] = Array.from(categoryMap.entries())
      .map(([key, acc]) => ({
        key,
        label: expenseCategoryMeta(key).label,
        color: expenseCategoryColor(key),
        amount: acc.amount,
        approx: acc.approx,
        pct: total > 0 ? (acc.amount / total) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);

    // Groups and books side by side — the same question ("where did it go")
    // with the container type kept so the row can say which it is.
    const containerMap = new Map<string, ContainerSpend>();
    for (const p of priced) {
      const key = `${p.entry.source}:${p.entry.containerId}`;
      const acc = containerMap.get(key) ?? {
        id: p.entry.containerId,
        name: p.entry.containerName,
        source: p.entry.source,
        amount: 0,
        approx: false
      };
      acc.amount += p.value;
      acc.approx ||= p.approx;
      containerMap.set(key, acc);
    }
    const byContainer = Array.from(containerMap.values()).sort(
      (a, b) => b.amount - a.amount
    );

    // Exact per-currency figures, unconverted — what the breakdown chip shows
    // behind the approximate headline.
    const currencyMap = new Map<string, number>();
    for (const entry of spend) {
      const currency = entry.currency || BASE_CURRENCY;
      currencyMap.set(currency, (currencyMap.get(currency) ?? 0) + entry.share);
    }
    const byCurrency = Array.from(currencyMap.entries())
      .map(([currency, amount]) => ({ currency, amount }))
      .sort((a, b) => {
        if (a.currency === BASE_CURRENCY) return -1;
        if (b.currency === BASE_CURRENCY) return 1;
        return b.amount - a.amount;
      });

    // Previous window — only the total is needed, so it skips the rest.
    let previousTotal: number | null = null;
    if (start) {
      previousTotal = 0;
      for (const entry of scopedPrevious) {
        if (entry.pending) continue;
        const value = convert(entry.share, entry.currency);
        if (value === null) continue;
        previousTotal += value;
      }
    }
    const deltaPct =
      previousTotal !== null && previousTotal > 0
        ? ((total - previousTotal) / previousTotal) * 100
        : null;

    // Ranked by converted value so a ¥ expense sorts correctly against a ₱ one;
    // the row still renders in its own currency, so the number stays exact.
    const topExpenses = [...priced]
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map((p) => p.entry);

    const { from, to } = trendWindow(start, end, scoped);
    const trend = buildTrend(priced, from, to);

    // Measured on the real span, not calendar days: a "1M" preset is exactly 30
    // days, and counting its endpoints would make it 31 and understate the rate.
    // Rounded so a custom range snapped to whole days (00:00 → 23:59:59.999)
    // still comes out whole.
    const days = Math.max(
      1,
      Math.round((to.getTime() - from.getTime()) / 86_400_000)
    );

    return {
      total,
      totalApprox,
      previousTotal,
      deltaPct,
      expenseCount: priced.length,
      average: priced.length > 0 ? total / priced.length : 0,
      perDay: total / days,
      pendingTotal,
      pendingApprox,
      fronted,
      frontedShare,
      frontingApprox,
      recurringTotal,
      recurringPct: total > 0 ? (recurringTotal / total) * 100 : 0,
      categories,
      byContainer,
      byCurrency,
      trend,
      topExpenses,
      partners: scope === "personal" ? [] : (fetched.partners ?? []),
      foreignCurrencies
    };
  }, [
    fetched,
    scoped,
    scopedPrevious,
    spend,
    convert,
    start,
    end,
    scope,
    foreignCurrencies
  ]);

  return { loading, error, data };
}

const filterByScope = (entries: AnalyticsEntry[], scope: AnalyticsScope) => {
  if (scope === "groups") return entries.filter((e) => e.source === "group");
  if (scope === "personal")
    return entries.filter((e) => e.source === "personal");
  return entries;
};

/**
 * The span the trend covers. A bounded range uses its own edges so empty
 * stretches still render as empty buckets — that gap is information. An "All
 * Time" range has no left edge, so it starts at the oldest expense.
 */
const trendWindow = (
  start: Date | null,
  end: Date | null,
  entries: AnalyticsEntry[]
): { from: Date; to: Date } => {
  const to = end ?? new Date();
  if (start) return { from: start, to };
  const times = entries.map((e) => new Date(e.date).getTime()).filter(Number.isFinite);
  return { from: times.length > 0 ? new Date(Math.min(...times)) : to, to };
};

type Granularity = "day" | "week" | "month" | "year";

/**
 * Bucket width, chosen so a chart never has to render more bars than a phone
 * can show. The thresholds line up with the preset ranges: 1D–2W come out
 * daily, 1M/3M weekly, 6M/1Y monthly, and a multi-year "All Time" yearly.
 */
const pickGranularity = (from: Date, to: Date): Granularity => {
  const days = differenceInCalendarDays(to, from);
  if (days <= 16) return "day";
  if (days <= 100) return "week";
  if (days <= 900) return "month";
  return "year";
};

const GRANULARITY = {
  day: { start: startOfDay, next: (d: Date) => addDays(d, 1), label: "d" },
  week: {
    start: (d: Date) => startOfWeek(d),
    next: (d: Date) => addWeeks(d, 1),
    label: "MMM d"
  },
  month: {
    start: startOfMonth,
    next: (d: Date) => addMonths(d, 1),
    label: "MMM"
  },
  year: { start: startOfYear, next: (d: Date) => addYears(d, 1), label: "yyyy" }
} as const;

/** Hard stop on bucket generation — a corrupt future date can't spin forever. */
const MAX_BUCKETS = 400;

const buildTrend = (
  priced: { entry: AnalyticsEntry; value: number }[],
  from: Date,
  to: Date
): TrendBucket[] => {
  const granularity = GRANULARITY[pickGranularity(from, to)];

  const buckets: TrendBucket[] = [];
  const index = new Map<string, TrendBucket>();

  let cursor = granularity.start(from);
  const limit = granularity.start(to).getTime();
  while (cursor.getTime() <= limit && buckets.length < MAX_BUCKETS) {
    const bucket: TrendBucket = {
      key: String(cursor.getTime()),
      label: format(cursor, granularity.label),
      showLabel: true,
      amount: 0
    };
    buckets.push(bucket);
    index.set(bucket.key, bucket);
    cursor = granularity.next(cursor);
  }

  for (const p of priced) {
    const date = new Date(p.entry.date);
    if (Number.isNaN(date.getTime())) continue;
    const bucket = index.get(String(granularity.start(date).getTime()));
    if (bucket) bucket.amount += p.value;
  }

  // Thin the axis to ~6 labels, anchored to the LAST bucket — the most recent
  // period is the one a reader looks for first, so it always keeps its label.
  const step = Math.ceil(buckets.length / 6);
  if (step > 1) {
    buckets.forEach((bucket, i) => {
      bucket.showLabel = (buckets.length - 1 - i) % step === 0;
    });
  }

  return buckets;
};
