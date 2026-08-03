import ApproxRateNote from "@/components/ApproxRateNote";
import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import LoadingWrapper from "@/components/LoadingWrapper";
import { AnalyticsSkeleton } from "@/components/SkeletonLoader";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { VStack } from "@/components/ui/vstack";
import AnalyticsContainersCard from "@/features/analytics/components/AnalyticsContainersCard";
import AnalyticsFrontingCard from "@/features/analytics/components/AnalyticsFrontingCard";
import AnalyticsPartnersCard from "@/features/analytics/components/AnalyticsPartnersCard";
import AnalyticsScopeTabs from "@/features/analytics/components/AnalyticsScopeTabs";
import AnalyticsTotalCard from "@/features/analytics/components/AnalyticsTotalCard";
import AnalyticsTrendCard from "@/features/analytics/components/AnalyticsTrendCard";
import {
  AnalyticsScope,
  useAnalytics
} from "@/features/analytics/hooks/useAnalytics";
import DateRangeSheet, {
  CustomDateRange,
  DateRangeOption,
  formatDateRangeLabel,
  getDateRangeBounds
} from "@/features/group/components/DateRangeSheet";
import InnerLayout from "@/layouts/InnerLayout";
import states from "@/states";
import { EmptyType } from "@/types/general";
import { getPrimaryHex } from "@/utils/getColorHex";
import { useRouter } from "expo-router";
import { ChevronDown } from "lucide-react-native";
import { useMemo, useState } from "react";
import { useColorScheme } from "react-native";

export default function AnalyticsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const { details: userDetails } = states.user();

  // Below the hooks on purpose — bailing before them would change the hook
  // count between renders the moment the user details land.
  if (!userDetails) return null;

  const [scope, setScope] = useState<AnalyticsScope>("all");
  const [dateRange, setDateRange] = useState<DateRangeOption>("1M");
  const [customRange, setCustomRange] = useState<CustomDateRange | null>(null);
  const [dateRangeSheetOpen, setDateRangeSheetOpen] = useState(false);

  const { start, end } = useMemo(
    () => getDateRangeBounds(dateRange, customRange),
    [dateRange, customRange]
  );

  const { loading, error, data } = useAnalytics(
    userDetails?.id,
    start,
    end,
    scope
  );

  const isEmpty = !data || data.expenseCount === 0;
  // Fronting is a group-only idea, and a period where nothing was fronted has
  // nothing to say about it.
  const showFronting =
    !!data &&
    scope !== "personal" &&
    (data.fronted > 0 || data.frontedShare > 0);

  return (
    <InnerLayout title="Spending Analytics" onBack={() => router.back()}>
      <DateRangeSheet
        isOpen={dateRangeSheetOpen}
        onClose={() => setDateRangeSheetOpen(false)}
        dateRange={dateRange}
        customRange={customRange}
        onSelect={(value, custom) => {
          setDateRange(value);
          setCustomRange(custom ?? null);
        }}
      />
      <ScrollView className="flex-1">
        <VStack className="gap-y-6 p-4">
          {/* Scope toggle + date range pill, matching the group Stats tab. The
              range applies to whichever scope is active. */}
          <HStack className="items-center justify-between gap-x-2">
            <AnalyticsScopeTabs scope={scope} onChange={setScope} />
            <FormButton
              size="sm"
              variant="outline"
              text={formatDateRangeLabel(dateRange, customRange)}
              iconEnd={
                <ChevronDown
                  size={16}
                  color={getPrimaryHex("text-primary-500", colorScheme)}
                />
              }
              onPress={() => setDateRangeSheetOpen(true)}
            />
          </HStack>

          <LoadingWrapper isLoading={loading} skeleton={<AnalyticsSkeleton />}>
            {error ? (
              // No cache behind this screen, so a failed read is the only thing
              // an empty state could mean — say so rather than claiming the user
              // has no expenses.
              <EmptyList
                type={EmptyType.ACTIVITY}
                content="Couldn't load your analytics. Check your connection and try again."
              />
            ) : isEmpty ? (
              <EmptyList
                type={EmptyType.ACTIVITY}
                content={emptyMessage(scope, dateRange)}
              />
            ) : (
              <>
                <AnalyticsTotalCard data={data} />

                {data.byContainer.length > 0 && (
                  <AnalyticsContainersCard containers={data.byContainer} />
                )}

                {data.trend.length > 0 && (
                  <AnalyticsTrendCard trend={data.trend} />
                )}

                {showFronting && <AnalyticsFrontingCard data={data} />}

                {data.partners.length > 0 && (
                  <AnalyticsPartnersCard partners={data.partners} />
                )}

                {/* One note for the whole screen — renders nothing when no
                    conversion happened, so the PHP-only case stays clean. */}
                <ApproxRateNote
                  currencies={data.foreignCurrencies}
                  className="px-1"
                />
              </>
            )}
          </LoadingWrapper>
        </VStack>
      </ScrollView>
    </InnerLayout>
  );
}

/**
 * An empty result has three different causes here and they need different
 * copy — otherwise narrowing the scope or the range reads as having lost data.
 */
const emptyMessage = (
  scope: AnalyticsScope,
  dateRange: DateRangeOption
): string | undefined => {
  const ranged = dateRange !== "All";
  if (scope === "personal") {
    return ranged
      ? "No personal expenses in the selected date range."
      : "No personal expenses yet. Add one in a book to see it here.";
  }
  if (scope === "groups") {
    return ranged
      ? "No group expenses in the selected date range."
      : "No group expenses yet.";
  }
  return ranged ? "No expenses in the selected date range." : undefined;
};
