import AppAvatar from "@/components/AppAvatar";
import FormButton from "@/components/FormButton";
import LoadingWrapper from "@/components/LoadingWrapper";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
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
import {
  ScrollView as HScrollView,
  ScrollView
} from "@/components/ui/scroll-view";
import { SectionList } from "@/components/ui/section-list";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import CurrencyAmountDisplay from "@/features/expense/components/CurrencyAmountDisplay";
import SettlementActionSheet from "@/features/expense/components/SettlementActionSheet";
import SettlementAvatar from "@/features/expense/components/SettlementAvatar";
import SettlementItem from "@/features/expense/components/SettlementItem";
import ViewBySheet, {
  ViewOption
} from "@/features/group/components/ViewBySheet";
import useAppToast from "@/hooks/use-app-toast";
import InnerLayout from "@/layouts/InnerLayout";
import services from "@/services";
import states from "@/states";
import { PaymentPreview } from "@/types/expenses";
import { getDateGroupTitle } from "@/utils/formatDate";
import { getPrimaryHex, getSecondaryHex } from "@/utils/getColorHex";
import { format, parseISO } from "date-fns";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Check, CheckCheck, LayoutList } from "lucide-react-native";
import { useMemo, useState } from "react";
import { useColorScheme } from "react-native";

export default function FriendDetailScreen() {
  const { friendId, name, email, avatar } = useLocalSearchParams<{
    friendId: string;
    name: string;
    email: string;
    avatar: string;
  }>();

  const [loading, setLoading] = useState(false);
  const [settlements, setSettlements] = useState<PaymentPreview[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<PaymentPreview | null>(
    null
  );
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [viewSheetOpen, setViewSheetOpen] = useState(false);
  const [viewBy, setViewBy] = useState<ViewOption>("By Date");
  const [pendingAction, setPendingAction] = useState<
    "settle" | "request" | null
  >(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [settlementTab, setSettlementTab] = useState<"Outstanding" | "History">(
    "Outstanding"
  );

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
        fetchSettlements(initialized);
      },
      [userDetails?.id, friendId, initialized]
    )
  );

  const fetchSettlements = async (isInitialized = false) => {
    if (!userDetails?.id || !friendId) return;
    if (!isInitialized) setLoading(true);
    try {
      const data = await services.friend.getFriendSettlements(
        userDetails.id,
        friendId
      );
      setSettlements(data);
    } catch (error) {
      console.error("Failed to fetch friend settlements:", error);
    } finally {
      if (!isInitialized) setLoading(false);
      setInitialized(true);
    }
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
      await fetchSettlements(true);
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

  const outstanding = useMemo(
    () => settlements.filter((s) => s.status !== "settled"),
    [settlements]
  );

  const canSettle = useMemo(
    () => outstanding.some((s) => s.payer.id === userDetails?.id),
    [outstanding, userDetails]
  );

  const canRequestSettle = useMemo(
    () =>
      outstanding.some(
        (s) => s.member.id === userDetails?.id && s.status === "pending"
      ),
    [outstanding, userDetails]
  );

  const toCollect = useMemo(() => {
    const map: Record<string, number> = {};
    outstanding
      .filter((s) => s.payer.id === userDetails?.id)
      .forEach((s) => {
        map[s.currency] = (map[s.currency] ?? 0) + s.amount;
      });
    return Object.entries(map).map(([currency, amount]) => ({
      currency,
      amount
    }));
  }, [outstanding, userDetails]);

  const toPay = useMemo(() => {
    const map: Record<string, number> = {};
    outstanding
      .filter((s) => s.member.id === userDetails?.id)
      .forEach((s) => {
        map[s.currency] = (map[s.currency] ?? 0) + s.amount;
      });
    return Object.entries(map).map(([currency, amount]) => ({
      currency,
      amount
    }));
  }, [outstanding, userDetails]);

  const filteredSettlements = useMemo(
    () =>
      settlementTab === "Outstanding"
        ? settlements.filter((s) => s.status !== "settled")
        : settlements.filter((s) => s.status === "settled"),
    [settlements, settlementTab]
  );

  const sections = useMemo(() => {
    if (viewBy === "By Expense") {
      const grouped: Record<string, PaymentPreview[]> = {};
      filteredSettlements.forEach((s) => {
        if (!grouped[s.expense_id]) grouped[s.expense_id] = [];
        grouped[s.expense_id].push(s);
      });
      return Object.keys(grouped).map((expenseId) => ({
        title: grouped[expenseId][0].expense_description || "Unknown Expense",
        data: grouped[expenseId]
      }));
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

    const groupedByDate: Record<string, PaymentPreview[]> = {};
    filteredSettlements.forEach((s) => {
      const dateKey = format(parseISO(s.created_at), "yyyy-MM-dd");
      if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
      groupedByDate[dateKey].push(s);
    });
    return Object.keys(groupedByDate)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .map((dateKey) => ({
        title: getDateGroupTitle(dateKey + "T00:00:00"),
        data: groupedByDate[dateKey]
      }));
  }, [filteredSettlements, viewBy, userDetails]);

  return (
    <>
      <InnerLayout title={decodedName} onBack={() => router.back()}>
        <ScrollView className="flex-1" bounces={false}>
          <VStack className="gap-y-4 pb-8">
            <VStack className="px-4 gap-y-4">
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
                        color={getSecondaryHex("text-secondary-0", colorScheme)}
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
                      <Check
                        color={getPrimaryHex("text-primary-500", colorScheme)}
                      />
                    }
                    onPress={() => setPendingAction("request")}
                  />
                )}
              </VStack>
            </VStack>

            <HStack className="px-4 items-center justify-between">
              <Text bold className="text-xl">
                Settlements
              </Text>
              <Button
                variant="link"
                className="rounded-full"
                onPress={() => setViewSheetOpen(true)}
              >
                <LayoutList
                  size={20}
                  color={getSecondaryHex("text-secondary-950", colorScheme)}
                />
              </Button>
            </HStack>

            <HScrollView horizontal showsHorizontalScrollIndicator={false}>
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

            <LoadingWrapper
              isLoading={loading}
              text="Loading settlements, please wait..."
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
                      {settlementTab === "Outstanding"
                        ? "No outstanding settlements with this person."
                        : "No settled history with this person yet."}
                    </Text>
                  </VStack>
                )}
              />
            </LoadingWrapper>
          </VStack>
        </ScrollView>
      </InnerLayout>

      <SettlementActionSheet
        isOpen={actionSheetOpen}
        onClose={() => {
          setActionSheetOpen(false);
          setSelectedPayment(null);
        }}
        item={selectedPayment}
        onRefetch={() => fetchSettlements(true)}
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
