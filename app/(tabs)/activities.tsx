import FormButton from "@/components/FormButton";
import LoadingWrapper from "@/components/LoadingWrapper";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { SectionList } from "@/components/ui/section-list";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import SettlementActionSheet from "@/features/expense/components/SettlementActionSheet";
import SettlementItem from "@/features/expense/components/SettlementItem";
import TabLayout from "@/layouts/TabLayout";
import services from "@/services";
import states from "@/states";
import { PaymentPreview } from "@/types/expenses";
import { getDateGroupTitle } from "@/utils/formatDate";
import { format, parseISO } from "date-fns";
import { useFocusEffect } from "expo-router";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

const roleOptions = ["All", "Collects", "Pays"] as const;
const statusOptions = ["All", "Pending", "Requested", "Settled"] as const;
type RoleOption = (typeof roleOptions)[number];
type StatusOption = (typeof statusOptions)[number];

export default function ActivitiesScreen() {
  const [loading, setLoading] = useState(false);
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);
  const [role, setRole] = useState<RoleOption>("All");
  const [status, setStatus] = useState<StatusOption>("All");
  const [page, setPage] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);

  const initialized = useRef(false);
  const isFirstRender = useRef(true);

  const [selectedPayment, setSelectedPayment] = useState<PaymentPreview | null>(
    null
  );
  const [actionSheetOpen, setActionSheetOpen] = useState(false);

  const { activityList } = states.expense.getState();
  const { details: userDetails } = states.user.getState();

  useFocusEffect(
    useMemo(
      () => () => {
        if (!userDetails?.id) return;
        fetchActivities(0, role, status, !initialized.current);
        initialized.current = true;
      },
      [userDetails?.id]
    )
  );

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!userDetails?.id) return;
    fetchActivities(0, role, status, true);
  }, [role, status]);

  const fetchActivities = async (
    pageNum: number,
    currentRole: RoleOption,
    currentStatus: StatusOption,
    showLoading = false
  ) => {
    if (showLoading) setLoading(true);
    try {
      const response = await services.expense.getPaymentsByUserId(
        userDetails?.id || "",
        pageNum,
        10,
        true,
        {
          role:
            currentRole === "All"
              ? undefined
              : (currentRole.toLowerCase() as "collects" | "pays"),
          status:
            currentStatus === "All"
              ? undefined
              : (currentStatus.toLowerCase() as
                  | "pending"
                  | "requested"
                  | "settled")
        }
      );

      if (!response) return;

      states.expense.setState((prev) => ({
        ...prev,
        activityList:
          pageNum === 0
            ? response.data || []
            : [...prev.activityList, ...(response.data || [])]
      }));
      setPage(pageNum);
      setHasNextPage(response.pagination?.hasNext || false);
    } catch (error) {
      console.log("Error fetching activities", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = async () => {
    setLoadMoreLoading(true);
    try {
      await fetchActivities(page + 1, role, status);
    } finally {
      setLoadMoreLoading(false);
    }
  };

  const formattedActivityList = useMemo(() => {
    const groupedByDate: Record<string, typeof activityList> = {};

    activityList.forEach((item) => {
      const dateKey = format(
        parseISO(item.created_at || new Date().toISOString()),
        "yyyy-MM-dd"
      );
      if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
      groupedByDate[dateKey].push(item);
    });

    return Object.keys(groupedByDate)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .map((dateKey) => ({
        title: getDateGroupTitle(dateKey + "T00:00:00"),
        data: groupedByDate[dateKey]
      }));
  }, [activityList]);

  return (
    <Fragment>
      <TabLayout title="Activities">
        <ScrollView className="flex-1" bounces={false}>
          <VStack className="gap-y-2 mb-4">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <HStack className="gap-x-2 px-4">
                {roleOptions.map((r) => (
                  <FormButton
                    key={r}
                    size="md"
                    variant={r === role ? "solid" : "outline"}
                    text={r}
                    onPress={() => setRole(r)}
                  />
                ))}
              </HStack>
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <HStack className="gap-x-2 px-4">
                {statusOptions.map((s) => (
                  <FormButton
                    key={s}
                    size="md"
                    variant={s === status ? "solid" : "outline"}
                    text={s}
                    onPress={() => setStatus(s)}
                  />
                ))}
              </HStack>
            </ScrollView>
          </VStack>
          <LoadingWrapper
            text="Loading activities, please wait..."
            isLoading={loading}
          >
            <SectionList
              bounces={false}
              scrollEnabled={false}
              sections={formattedActivityList}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <SettlementItem
                  item={item}
                  onPress={() => {
                    setSelectedPayment(item);
                    setActionSheetOpen(true);
                  }}
                />
              )}
              renderSectionHeader={({ section: { title } }) => (
                <Box className="bg-background-50 px-4 py-2 border-b border-secondary-100">
                  <Text className="text-sm text-secondary-950">{title}</Text>
                </Box>
              )}
              ItemSeparatorComponent={() => (
                <Box className="mx-4">
                  <Divider className="border-secondary-100" />
                </Box>
              )}
              stickySectionHeadersEnabled={true}
              ListEmptyComponent={() => (
                <VStack className="flex-1 justify-center items-center p-4">
                  <Text className="text-secondary-950 text-center">
                    No payments found.
                  </Text>
                </VStack>
              )}
              ListFooterComponent={
                hasNextPage ? (
                  <FormButton
                    size="md"
                    variant="outline"
                    className="mx-4 my-2"
                    text="Load More"
                    loading={loadMoreLoading}
                    onPress={handleLoadMore}
                  />
                ) : (
                  <VStack className="justify-center items-center p-4">
                    <Text className="text-secondary-950 text-center">
                      You've reached the end.
                    </Text>
                  </VStack>
                )
              }
            />
          </LoadingWrapper>
        </ScrollView>
      </TabLayout>
      <SettlementActionSheet
        isOpen={actionSheetOpen}
        onClose={() => setActionSheetOpen(false)}
        item={selectedPayment}
        onRefetch={() => fetchActivities(0, role, status, true)}
      />
    </Fragment>
  );
}
