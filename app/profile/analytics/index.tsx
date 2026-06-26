import AppAvatar from "@/components/AppAvatar";
import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import ListDivider from "@/components/ListDivider";
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { AnalyticsData } from "@/features/analytics/services/analytics.service";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import {
  DateRangeOption,
  getDateRangeCutoff
} from "@/features/group/components/DateRangeSheet";
import InnerLayout from "@/layouts/InnerLayout";
import services from "@/services";
import states from "@/states";
import { EmptyType } from "@/types/general";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator } from "react-native";

const ANALYTICS_DATE_RANGES: DateRangeOption[] = [
  "1M",
  "3M",
  "6M",
  "1Y",
  "All"
];
const BAR_MAX_HEIGHT = 72;

export default function AnalyticsScreen() {
  const router = useRouter();
  const { details: userDetails, defaultCurrency } = states.user();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeOption>("1M");

  const cutoff = useMemo(() => getDateRangeCutoff(dateRange), [dateRange]);

  const fetchData = useCallback(async () => {
    if (!userDetails?.id) return;
    setLoading(true);
    try {
      const result = await services.analytics.getAnalyticsData(
        userDetails.id,
        cutoff
      );
      setData(result);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
    }
  }, [userDetails?.id, cutoff]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const maxGroupAmount = useMemo(
    () => Math.max(...(data?.byGroup.map((g) => g.amount) ?? [1])),
    [data]
  );

  const maxMonthAmount = useMemo(
    () => Math.max(...(data?.monthlyTrend.map((m) => m.amount) ?? [1])),
    [data]
  );

  return (
    <InnerLayout title="Spending Analytics" onBack={() => router.back()}>
      <ScrollView className="flex-1">
        <VStack className="gap-y-6 p-4">
          {/* Date range tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <HStack className="gap-x-2">
              {ANALYTICS_DATE_RANGES.map((option) => (
                <FormButton
                  key={option}
                  size="sm"
                  variant={dateRange === option ? "solid" : "outline"}
                  text={option === "All" ? "All Time" : option}
                  onPress={() => setDateRange(option)}
                />
              ))}
            </HStack>
          </ScrollView>

          {loading ? (
            <VStack className="flex-1 items-center justify-center py-16">
              <ActivityIndicator />
            </VStack>
          ) : !data || data.summary.expenseCount === 0 ? (
            <EmptyList type={EmptyType.ACTIVITY} />
          ) : (
            <>
              {/* Summary card */}
              <Card className="rounded-2xl bg-secondary-100">
                <VStack className="gap-y-4">
                  <Text bold className="uppercase text-secondary-950 text-sm">
                    Overview
                  </Text>
                  <HStack className="items-center gap-x-2">
                    <Text bold className="text-3xl text-primary-400">
                      {data.summary.expenseCount}
                    </Text>
                    <Text className="text-secondary-950">
                      Expense{data.summary.expenseCount !== 1 ? "s" : ""}
                    </Text>
                  </HStack>
                  <Divider />
                  <HStack className="items-center justify-between gap-x-4">
                    <Text className="text-secondary-950">Involved</Text>
                    <Text bold className="text-xl">
                      {formatAmount(
                        data.summary.totalInvolved,
                        defaultCurrency
                      )}
                    </Text>
                  </HStack>
                  <HStack className="items-center justify-between gap-x-4">
                    <Text className="text-secondary-950">You Paid</Text>
                    <Text bold className="text-xl">
                      {formatAmount(data.summary.totalPaid, defaultCurrency)}
                    </Text>
                  </HStack>
                </VStack>
              </Card>

              {/* Spending by group */}
              {data.byGroup.length > 0 && (
                <VStack className="gap-y-2">
                  <Text bold className="text-2xl">
                    Spending by Group
                  </Text>
                  <Card className="rounded-2xl bg-secondary-100 py-6">
                    <VStack className="gap-y-6">
                      {data.byGroup.map((group) => {
                        const pct =
                          maxGroupAmount > 0
                            ? group.amount / maxGroupAmount
                            : 0;
                        return (
                          <VStack key={group.groupId} className="gap-y-1">
                            <HStack className="justify-between items-center">
                              <Text
                                className="flex-1 text-lg"
                                numberOfLines={1}
                              >
                                {group.groupName}
                              </Text>
                              <Text bold className="text-lg">
                                {formatAmount(group.amount, defaultCurrency)}
                              </Text>
                            </HStack>
                            <Box className="h-2 rounded-full bg-background-200 overflow-hidden">
                              <Box
                                className="h-2 rounded-full bg-primary-400"
                                style={{ width: `${Math.max(pct * 100, 4)}%` }}
                              />
                            </Box>
                          </VStack>
                        );
                      })}
                    </VStack>
                  </Card>
                </VStack>
              )}

              {/* Monthly trend */}
              <VStack className="gap-y-2">
                <Text bold className="text-2xl">
                  Monthly Trend
                </Text>
                <Card className="rounded-2xl bg-secondary-100">
                  <VStack className="gap-y-3">
                    <HStack
                      className="items-end gap-x-2"
                      style={{ height: BAR_MAX_HEIGHT + 24 }}
                    >
                      {data.monthlyTrend.map((month) => {
                        const barH =
                          maxMonthAmount > 0
                            ? Math.max(
                                (month.amount / maxMonthAmount) *
                                  BAR_MAX_HEIGHT,
                                month.amount > 0 ? 4 : 0
                              )
                            : 0;
                        return (
                          <VStack
                            key={month.key}
                            className="flex-1 items-center gap-y-1"
                            style={{ justifyContent: "flex-end" }}
                          >
                            <Box
                              className={`w-full rounded-t-md ${month.amount > 0 ? "bg-primary-400" : "bg-background-200"}`}
                              style={{ height: barH || 4 }}
                            />
                            <Text className="text-secondary-950 text-xs">
                              {month.label}
                            </Text>
                          </VStack>
                        );
                      })}
                    </HStack>
                  </VStack>
                </Card>
              </VStack>

              {/* Top split partners */}
              {data.topPartners.length > 0 && (
                <VStack className="gap-y-2">
                  <Text bold className="text-2xl">
                    Top Split Partners
                  </Text>
                  <Card className="rounded-2xl bg-secondary-100 p-0 overflow-hidden">
                    <VStack>
                      {data.topPartners.map((partner, index) => (
                        <Box key={partner.id}>
                          <HStack className="p-4 gap-x-3 items-center">
                            <AppAvatar
                              name={partner.firstName}
                              uri={partner.avatar ?? undefined}
                            />
                            <VStack className="flex-1">
                              <Text className="text-lg">
                                {partner.firstName} {partner.lastName}
                              </Text>
                              <Text className="text-secondary-950 text-sm">
                                {partner.count} shared expense
                                {partner.count !== 1 ? "s" : ""}
                              </Text>
                            </VStack>
                            <Box className="bg-primary-50 dark:bg-primary-900 px-3 py-1 rounded-full">
                              <Text bold className="text-primary-400 text-sm">
                                #{index + 1}
                              </Text>
                            </Box>
                          </HStack>
                          {index < data.topPartners.length - 1 && (
                            <ListDivider />
                          )}
                        </Box>
                      ))}
                    </VStack>
                  </Card>
                </VStack>
              )}
            </>
          )}
        </VStack>
      </ScrollView>
    </InnerLayout>
  );
}
