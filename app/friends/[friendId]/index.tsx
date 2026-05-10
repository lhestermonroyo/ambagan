import AppAvatar from "@/components/AppAvatar";
import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import ListFooter from "@/components/ListFooter";
import LoadingWrapper from "@/components/LoadingWrapper";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader
} from "@/components/ui/modal";
import { Pressable } from "@/components/ui/pressable";
import {
  ScrollView as HScrollView,
  ScrollView
} from "@/components/ui/scroll-view";
import { SectionList } from "@/components/ui/section-list";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import ListDivider from "@/components/ListDivider";
import CurrencyAmountDisplay from "@/features/expense/components/CurrencyAmountDisplay";
import SettlementActionSheet from "@/features/expense/components/SettlementActionSheet";
import SettlementAvatar from "@/features/expense/components/SettlementAvatar";
import SettlementItem from "@/features/expense/components/SettlementItem";
import { groupByDate, groupByExpenseId } from "@/features/expense/utils/grouping.util";
import DateRangeSheet, {
  DateRangeOption,
  dateRangeLabels,
  getDateRangeCutoff
} from "@/features/group/components/DateRangeSheet";
import ViewBySheet, {
  ViewOption
} from "@/features/group/components/ViewBySheet";
import useAppToast from "@/hooks/use-app-toast";
import InnerLayout from "@/layouts/InnerLayout";
import services from "@/services";
import states from "@/states";
import { PaymentPreview } from "@/types/expenses";
import { EmptyType } from "@/types/general";
import { groupByCurrency } from "@/utils/currency";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  CalendarRange,
  CheckCheck,
  FileCheckCorner,
  LayoutList,
  X
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshControl, useColorScheme } from "react-native";

export default function FriendDetailScreen() {
  const { friendId, name, email, avatar, tab } = useLocalSearchParams<{
    friendId: string;
    name: string;
    email: string;
    avatar: string;
    tab?: string;
  }>();

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSettlements, setActiveSettlements] = useState<PaymentPreview[]>(
    []
  );
  const [settledSettlements, setSettledSettlements] = useState<
    PaymentPreview[]
  >([]);
  const [settledPage, setSettledPage] = useState(0);
  const [hasMoreSettled, setHasMoreSettled] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentPreview | null>(
    null
  );
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [viewSheetOpen, setViewSheetOpen] = useState(false);
  const [viewBy, setViewBy] = useState<ViewOption>("By Date");
  const [dateRangeSheetOpen, setDateRangeSheetOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeOption>("All");
  const [pendingAction, setPendingAction] = useState<
    "settle" | "request" | null
  >(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [settlementTab, setSettlementTab] = useState<"Outstanding" | "History">(
    tab === "History" ? "History" : "Outstanding"
  );
  const initializedRef = useRef(false);

  const { details: userDetails } = states.user();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const toast = useAppToast();

  const decodedName = decodeURIComponent(name || "");
  const decodedEmail = decodeURIComponent(email || "");
  const decodedAvatar = decodeURIComponent(avatar || "");

  useFocusEffect(
    useMemo(
      () => () => {
        if (!userDetails?.id || !friendId) return;
        fetchAll(!initialized);
      },
      [userDetails?.id, friendId, initialized]
    )
  );

  useEffect(() => {
    if (!initializedRef.current) return;
    if (!userDetails?.id || !friendId) return;
    const cutoff = getDateRangeCutoff(dateRange);
    setSettledSettlements([]);
    setSettledPage(0);
    fetchSettled(0, cutoff);
  }, [dateRange]);

  const fetchAll = async (showLoading = true) => {
    if (!userDetails?.id || !friendId) return;
    if (showLoading) setLoading(true);
    try {
      const cutoff = getDateRangeCutoff(dateRange);
      const [active, settled] = await Promise.all([
        services.friend.getActiveFriendSettlements(userDetails.id, friendId),
        services.friend.getSettledFriendSettlements(userDetails.id, friendId, {
          cutoff,
          page: 0
        })
      ]);
      setActiveSettlements(active);
      setSettledSettlements(settled.data);
      setSettledPage(0);
      setHasMoreSettled(settled.hasNext);
      initializedRef.current = true;
    } catch (error) {
      console.error("Failed to fetch friend settlements:", error);
    } finally {
      if (showLoading) setLoading(false);
      setInitialized(true);
    }
  };

  const fetchSettled = async (page: number, cutoff: Date | null) => {
    if (!userDetails?.id || !friendId) return;
    try {
      const result = await services.friend.getSettledFriendSettlements(
        userDetails.id,
        friendId,
        { cutoff, page }
      );
      setSettledSettlements((prev) =>
        page === 0 ? result.data : [...prev, ...result.data]
      );
      setSettledPage(page);
      setHasMoreSettled(result.hasNext);
    } catch (error) {
      console.error("Failed to fetch settled friend settlements:", error);
    }
  };

  const loadMoreSettled = async () => {
    setLoadingMore(true);
    try {
      await fetchSettled(settledPage + 1, getDateRangeCutoff(dateRange));
    } finally {
      setLoadingMore(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll(false);
    setRefreshing(false);
  };

  const handleConfirmAction = async () => {
    if (!userDetails?.id || !friendId || !pendingAction) return;
    setActionLoading(true);
    try {
      if (pendingAction === "settle") {
        await services.friend.bulkSettleWithFriend(userDetails.id, friendId);
        toast({
          title: "All settled!",
          description: `All your collections from ${decodedName} have been marked as settled.`,
          type: "success"
        });
      } else {
        await services.friend.bulkRequestSettleWithFriend(
          userDetails.id,
          friendId
        );
        toast({
          title: "Requests sent!",
          description: `All your pending settlements with ${decodedName} have been requested.`,
          type: "success"
        });
      }
      setPendingAction(null);
      await fetchAll(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        type: "error"
      });
    } finally {
      setActionLoading(false);
    }
  };

  const canSettle = useMemo(
    () => activeSettlements.some((s) => s.payer.id === userDetails?.id),
    [activeSettlements, userDetails]
  );

  const canRequestSettle = useMemo(
    () =>
      activeSettlements.some(
        (s) => s.member.id === userDetails?.id && s.status === "pending"
      ),
    [activeSettlements, userDetails]
  );

  const toCollect = useMemo(
    () =>
      groupByCurrency(activeSettlements.filter((s) => s.payer.id === userDetails?.id)),
    [activeSettlements, userDetails]
  );

  const toPay = useMemo(
    () =>
      groupByCurrency(activeSettlements.filter((s) => s.member.id === userDetails?.id)),
    [activeSettlements, userDetails]
  );

  const filteredSettlements = useMemo(() => {
    if (settlementTab === "History") return settledSettlements;
    const cutoff = getDateRangeCutoff(dateRange);
    return activeSettlements.filter(
      (s) => !cutoff || new Date(s.created_at) >= cutoff
    );
  }, [activeSettlements, settledSettlements, settlementTab, dateRange]);

  const sections = useMemo(() => {
    if (viewBy === "By Expense") {
      return groupByExpenseId(filteredSettlements);
    }

    if (viewBy === "By Person") {
      const grouped: Record<string, PaymentPreview[]> = {};
      filteredSettlements.forEach((s) => {
        const isUserPayer = s.payer.id === userDetails?.id;
        const key = isUserPayer ? "collect" : "pay";
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(s);
      });
      return [
        grouped["collect"]?.length && {
          title: "To Collect",
          data: grouped["collect"]
        },
        grouped["pay"]?.length && {
          title: "To Pay",
          data: grouped["pay"]
        }
      ].filter(Boolean) as { title: string; data: PaymentPreview[] }[];
    }

    return groupByDate(filteredSettlements);
  }, [filteredSettlements, viewBy, userDetails]);

  return (
    <>
      <InnerLayout title="Friend Details" onBack={() => router.back()}>
        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <VStack className="gap-y-8">
            <VStack className="px-4 gap-y-8">
              <HStack className="gap-x-3 items-center">
                <AppAvatar
                  name={decodedName}
                  uri={decodedAvatar || undefined}
                  size="lg"
                />
                <VStack>
                  <Text bold className="text-xl">
                    {decodedName}
                  </Text>
                  <Text className="text-secondary-950">{decodedEmail}</Text>
                </VStack>
              </HStack>

              <VStack className="gap-y-4">
                <HStack className="gap-x-2">
                  <Card className="flex-1 rounded-lg bg-secondary-100">
                    <VStack className="gap-y-2">
                      <SettlementAvatar isPayer={true} />
                      <VStack className="justify-between">
                        <CurrencyAmountDisplay
                          isLoading={loading}
                          items={toCollect}
                          label="To Collect"
                          type="receive"
                        />
                        <Text className="text-secondary-950">To Collect</Text>
                      </VStack>
                    </VStack>
                  </Card>
                  <Card className="flex-1 rounded-lg bg-secondary-100">
                    <VStack className="gap-y-2">
                      <SettlementAvatar isPayer={false} />
                      <VStack className="justify-between">
                        <CurrencyAmountDisplay
                          isLoading={loading}
                          items={toPay}
                          label="To Pay"
                          type="pay"
                        />
                        <Text className="text-secondary-950">To Pay</Text>
                      </VStack>
                    </VStack>
                  </Card>
                </HStack>
                <VStack className="gap-y-2">
                  {canSettle && (
                    <FormButton
                      text="Settle All"
                      icon={
                        <CheckCheck
                          color={getSecondaryHex(
                            "text-secondary-0",
                            colorScheme
                          )}
                        />
                      }
                      onPress={() => setPendingAction("settle")}
                    />
                  )}
                  {canRequestSettle && (
                    <FormButton
                      variant="outline"
                      text="Request All as Settled"
                      icon={
                        <FileCheckCorner
                          color={getPrimaryHex("text-primary-500", colorScheme)}
                        />
                      }
                      onPress={() => setPendingAction("request")}
                    />
                  )}
                </VStack>
              </VStack>
            </VStack>

            <VStack className="gap-y-4">
              <HStack>
                <HScrollView
                  horizontal
                  className="flex-1"
                  showsHorizontalScrollIndicator={false}
                >
                  <HStack className="gap-x-2 px-4">
                    {(["Outstanding", "History"] as const).map((tab) => (
                      <FormButton
                        key={tab}
                        size="md"
                        variant={tab === settlementTab ? "solid" : "outline"}
                        text={tab}
                        onPress={() => setSettlementTab(tab)}
                      />
                    ))}
                  </HStack>
                </HScrollView>
                <HStack className="gap-x-6 px-4">
                  <Button
                    variant="link"
                    size="lg"
                    className="rounded-full"
                    onPress={() => setDateRangeSheetOpen(true)}
                  >
                    <CalendarRange
                      color={
                        dateRange !== "All"
                          ? getPrimaryHex("text-primary-400", colorScheme)
                          : getSecondaryHex("text-secondary-950", colorScheme)
                      }
                    />
                  </Button>
                  <Button
                    variant="link"
                    size="lg"
                    className="rounded-full"
                    onPress={() => setViewSheetOpen(true)}
                  >
                    <LayoutList
                      color={
                        viewBy !== "By Date"
                          ? getPrimaryHex("text-primary-400", colorScheme)
                          : getSecondaryHex("text-secondary-950", colorScheme)
                      }
                    />
                  </Button>
                </HStack>
              </HStack>

              {(dateRange !== "All" || viewBy !== "By Date") && (
                <HStack className="gap-x-2 px-4 flex-wrap">
                  {dateRange !== "All" && (
                    <Pressable
                      onPress={() => setDateRange("All")}
                      className="flex-row items-center gap-x-1 bg-primary-100 border border-primary-200 rounded-full px-3 py-1"
                    >
                      <Text className="text-sm text-primary-600">
                        {dateRangeLabels[dateRange]}
                      </Text>
                      <X
                        size={12}
                        color={getPrimaryHex("text-primary-600", colorScheme)}
                      />
                    </Pressable>
                  )}
                  {viewBy !== "By Date" && (
                    <Pressable
                      onPress={() => setViewBy("By Date")}
                      className="flex-row items-center gap-x-1 bg-primary-100 border border-primary-200 rounded-full px-3 py-1"
                    >
                      <Text className="text-sm text-primary-600">{viewBy}</Text>
                      <X
                        size={12}
                        color={getPrimaryHex("text-primary-600", colorScheme)}
                      />
                    </Pressable>
                  )}
                </HStack>
              )}

              <LoadingWrapper
                isLoading={loading}
                text="Loading friend settlements..."
              >
                <SectionList
                  scrollEnabled={false}
                  sections={sections}
                  keyExtractor={(item) => item.id}
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
                      <Text className="text-sm text-secondary-950">
                        {title}
                      </Text>
                    </Box>
                  )}
                  ItemSeparatorComponent={ListDivider}
                  stickySectionHeadersEnabled={true}
                  ListEmptyComponent={() => (
                    <EmptyList
                      type={
                        settlementTab === "Outstanding"
                          ? EmptyType.OUTSTANDING
                          : EmptyType.HISTORY
                      }
                    />
                  )}
                  ListFooterComponent={() =>
                    settlementTab === "History" && hasMoreSettled ? (
                      <ListFooter
                        hasNextPage={hasMoreSettled}
                        loading={loadingMore}
                        onLoadMore={loadMoreSettled}
                      />
                    ) : null
                  }
                />
              </LoadingWrapper>
            </VStack>
          </VStack>
        </ScrollView>
      </InnerLayout>

      <SettlementActionSheet
        isOpen={actionSheetOpen}
        onClose={() => setActionSheetOpen(false)}
        item={selectedPayment}
        onRefetch={() => fetchAll(false)}
      />
      <DateRangeSheet
        isOpen={dateRangeSheetOpen}
        onClose={() => setDateRangeSheetOpen(false)}
        dateRange={dateRange}
        onSelect={setDateRange}
      />
      <ViewBySheet
        isOpen={viewSheetOpen}
        onClose={() => setViewSheetOpen(false)}
        viewBy={viewBy}
        onSelect={setViewBy}
      />
      <Modal
        isOpen={pendingAction !== null}
        onClose={() => setPendingAction(null)}
      >
        <ModalBackdrop />
        <ModalContent>
          <ModalHeader>
            <Heading>
              {pendingAction === "settle"
                ? "Settle All"
                : "Request All as Settled"}
            </Heading>
          </ModalHeader>
          <ModalBody>
            <Text>
              {pendingAction === "settle"
                ? `This will mark all your outstanding collections from ${decodedName} as settled. This action cannot be undone.`
                : `This will send a settlement request for all your pending payments to ${decodedName}.`}
            </Text>
          </ModalBody>
          <ModalFooter className="gap-x-2">
            <FormButton
              className="flex-1"
              variant="outline"
              text="Cancel"
              onPress={() => setPendingAction(null)}
            />
            <FormButton
              className="flex-1"
              text={pendingAction === "settle" ? "Settle All" : "Request All"}
              loading={actionLoading}
              onPress={handleConfirmAction}
            />
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
