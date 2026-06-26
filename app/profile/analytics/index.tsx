import AppAvatar from "@/components/AppAvatar";
import EmptyList from "@/components/EmptyList";
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import {
  DateRangeOption,
  dateRangeOptions,
  getDateRangeCutoff
} from "@/features/group/components/DateRangeSheet";
import InnerLayout from "@/layouts/InnerLayout";
import services from "@/services";
import { AnalyticsData } from "@/features/analytics/services/analytics.service";
import states from "@/states";
import { EmptyType } from "@/types/general";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator } from "react-native";

const ANALYTICS_DATE_RANGES: DateRangeOption[] = ["1M", "3M", "6M", "1Y", "All"];
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
        <VStack className="gap-y-6 p-4 pb-10">

          {/* Date range pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <HStack className="gap-x-2">
              {ANALYTICS_DATE_RANGES.map((option) => (
                <Box
                  key={option}
                  className={`px-4 py-2 rounded-full border ${
                    dateRange === option
                      ? "bg-primary-400 border-primary-400"
                      : "border-background-200 bg-background-50"
                  }`}
                >
                  <Text
                    bold={dateRange === option}
                    className={dateRange === option ? "text-background-0" : "text-secondary-950"}
                    onPress={() => setDateRange(option)}
                  >
                    {option === "All" ? "All Time" : option}
                  </Text>
                </Box>
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
                  <Text bold className="text-base uppercase text-secondary-950 tracking-widest">
                    Overview
                  </Text>
                  <HStack className="items-stretch">
                    <VStack className="flex-1 items-center gap-y-1">
                      <Text bold className="text-2xl text-primary-400">
                        {data.summary.expenseCount}
                      </Text>
                      <Text className="text-secondary-950 text-sm text-center">
                        Expenses
                      </Text>
                    </VStack>
                    <Divider orientation="vertical" className="mx-2" />
                    <VStack className="flex-1 items-center gap-y-1">
                      <Text bold className="text-2xl">
                        {formatAmount(data.summary.totalInvolved, defaultCurrency)}
                      </Text>
                      <Text className="text-secondary-950 text-sm text-center">
                        Involved
                      </Text>
                    </VStack>
                    <Divider orientation="vertical" className="mx-2" />
                    <VStack className="flex-1 items-center gap-y-1">
                      <Text bold className="text-2xl text-success-600">
                        {formatAmount(data.summary.totalPaid, defaultCurrency)}
                      </Text>
                      <Text className="text-secondary-950 text-sm text-center">
                        You Paid
                      </Text>
                    </VStack>
                  </HStack>
                </VStack>
              </Card>

              {/* Spending by group */}
              {data.byGroup.length > 0 && (
                <VStack className="gap-y-3">
                  <Text bold className="text-lg">
                    Spending by Group
                  </Text>
                  <Card className="rounded-2xl bg-secondary-100">
                    <VStack className="gap-y-4">
                      {data.byGroup.map((group) => {
                        const pct = maxGroupAmount > 0
                          ? group.amount / maxGroupAmount
                          : 0;
                        return (
                          <VStack key={group.groupId} className="gap-y-1">
                            <HStack className="justify-between items-center">
                              <Text
                                className="flex-1 text-base"
                                numberOfLines={1}
                              >
                                {group.groupName}
                              </Text>
                              <Text bold className="text-base">
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
              <VStack className="gap-y-3">
                <Text bold className="text-lg">
                  Monthly Trend
                </Text>
                <Card className="rounded-2xl bg-secondary-100">
                  <VStack className="gap-y-3">
                    <HStack
                      className="items-end gap-x-2"
                      style={{ height: BAR_MAX_HEIGHT + 24 }}
                    >
                      {data.monthlyTrend.map((month) => {
                        const barH = maxMonthAmount > 0
                          ? Math.max((month.amount / maxMonthAmount) * BAR_MAX_HEIGHT, month.amount > 0 ? 4 : 0)
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
                <VStack className="gap-y-3">
                  <Text bold className="text-lg">
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
                              <Text bold className="text-base">
                                {partner.firstName} {partner.lastName}
                              </Text>
                              <Text className="text-secondary-950 text-sm">
                                {partner.count} shared expense{partner.count !== 1 ? "s" : ""}
                              </Text>
                            </VStack>
                            <Box className="bg-primary-50 dark:bg-primary-900 px-3 py-1 rounded-full">
                              <Text bold className="text-primary-400 text-sm">
                                #{index + 1}
                              </Text>
                            </Box>
                          </HStack>
                          {index < data.topPartners.length - 1 && (
                            <Divider className="border-background-200" />
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
