import AppAvatar from "@/components/AppAvatar";
import ConfirmButton from "@/components/ConfirmButton";
import EmptyList from "@/components/EmptyList";
import FormButton from "@/components/FormButton";
import LoadingWrapper from "@/components/LoadingWrapper";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import {
  Radio,
  RadioGroup,
  RadioIcon,
  RadioIndicator
} from "@/components/ui/radio";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import SettlementAvatar from "@/features/expense/components/SettlementAvatar";
import StatusBadge from "@/features/expense/components/StatusBadge";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import useAppToast from "@/hooks/use-app-toast";
import services from "@/services";
import states from "@/states";
import { Payment } from "@/types/expenses";
import { EmptyType } from "@/types/general";
import { Member } from "@/types/groups";
import { formatDate } from "@/utils/formatDate";
import { getErrorHex, getPrimaryHex } from "@/utils/getColorHex";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { AlertTriangle, CircleIcon } from "lucide-react-native";
import { Fragment, useEffect, useState } from "react";
import { useColorScheme } from "react-native";

export default function LeaveGroupSheet({
  isOpen,
  onClose,
  onLeave
}: {
  isOpen: boolean;
  onClose: () => void;
  onLeave: (groupDeleted: boolean) => void;
}) {
  const { details: groupDetails, memberList } = states.group.getState();
  const { details: userDetails } = states.user();
  const colorScheme = useColorScheme() ?? "light";

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [unsettledPayments, setUnsettledPayments] = useState<Payment[]>([]);
  const [selectedNewAdmin, setSelectedNewAdmin] = useState<Member | null>(null);

  const toast = useAppToast();

  const isAdmin = groupDetails?.admin.id === userDetails?.id;
  const otherMembers = memberList.filter((m) => m.id !== userDetails?.id);
  const isSoleAdmin = isAdmin && otherMembers.length === 0;

  useEffect(() => {
    if (isOpen && groupDetails?.id && userDetails?.id) {
      setSelectedNewAdmin(null);
      fetchUnsettled();
    }
  }, [isOpen]);

  const fetchUnsettled = async () => {
    if (!groupDetails?.id || !userDetails?.id) return;
    setFetching(true);
    try {
      const payments = await services.expense.getPaymentsByGroupAndUserId(
        groupDetails.id,
        userDetails.id
      );
      setUnsettledPayments(
        payments.filter(
          (p) => p.status === "pending" || p.status === "requested"
        )
      );
    } catch (error) {
      console.error("Error fetching unsettled payments:", error);
    } finally {
      setFetching(false);
    }
  };

  const handleLeave = async () => {
    if (!groupDetails?.id || !userDetails?.id) return;
    setLoading(true);
    try {
      const result = await services.member.leaveGroup(
        groupDetails.id,
        userDetails.id,
        selectedNewAdmin?.id
      );
      toast({
        description: result.groupDeleted
          ? "You left and the group was deleted."
          : "You have left the group.",
        type: "success"
      });
      onLeave(result.groupDeleted);
    } catch (error) {
      console.error("Error leaving group:", error);
      toast({
        title: "Error",
        description: "Failed to leave the group. Please try again.",
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const hasUnsettled = unsettledPayments.length > 0;
  const adminNeedsSelection = isAdmin && !isSoleAdmin && !selectedNewAdmin;
  const canLeave = !fetching && !hasUnsettled && !adminNeedsSelection;
  const snapPoints = hasUnsettled || (isAdmin && !isSoleAdmin) ? [90] : [30];

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={snapPoints}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full flex-1">
          <VStack className="p-4">
            <Text bold className="text-xl">
              Leave Group
            </Text>
          </VStack>
          <ScrollView className="flex-1">
            <VStack className="gap-y-4">
              <LoadingWrapper isLoading={fetching}>
                {hasUnsettled ? (
                  <Fragment>
                    <HStack className="bg-error-50 rounded-xl gap-x-4 p-4 mx-4 items-start">
                      <AlertTriangle
                        color={getErrorHex("text-error-600", colorScheme)}
                      />
                      <Text className="text-error-600 flex-1">
                        You have{" "}
                        <Text bold className="text-error-600">
                          {unsettledPayments.length} unsettled{" "}
                          {unsettledPayments.length === 1
                            ? "payment"
                            : "payments"}
                        </Text>{" "}
                        in this group. Resolve all of them before leaving.
                      </Text>
                    </HStack>

                    <FlatList
                      className="rounded-xl overflow-hidden"
                      scrollEnabled={false}
                      data={unsettledPayments}
                      keyExtractor={(item) => item.id}
                      renderItem={({ item }) => <SettlementItem item={item} />}
                      ItemSeparatorComponent={() => (
                        <Box className="mx-4">
                          <Divider className="border-secondary-200" />
                        </Box>
                      )}
                    />
                  </Fragment>
                ) : isSoleAdmin ? (
                  <HStack className="bg-primary-50 rounded-xl gap-x-3 p-4 items-start">
                    <AlertTriangle
                      color={getPrimaryHex("text-primary-600", colorScheme)}
                    />
                    <Text className="text-primary-600 flex-1">
                      You are the only member. Leaving will{" "}
                      <Text bold className="text-primary-600">
                        permanently delete this group
                      </Text>{" "}
                      and all its data.
                    </Text>
                  </HStack>
                ) : isAdmin ? (
                  <>
                    <HStack className="bg-primary-50 rounded-xl gap-x-3 p-4 items-start">
                      <AlertTriangle
                        size={18}
                        color={getPrimaryHex("text-primary-600", colorScheme)}
                      />
                      <Text className="text-primary-600 flex-1">
                        You are the group admin. Select a member to transfer
                        admin to before leaving.
                      </Text>
                    </HStack>

                    <VStack className="gap-y-1">
                      <Text className="font-medium">Transfer admin to</Text>
                      <RadioGroup
                        value={selectedNewAdmin?.id ?? ""}
                        onChange={(id) => {
                          const member = otherMembers.find((m) => m.id === id);
                          setSelectedNewAdmin(member ?? null);
                        }}
                      >
                        <FlatList
                          className="rounded-xl overflow-hidden"
                          scrollEnabled={false}
                          data={otherMembers}
                          keyExtractor={(item) => item.id}
                          renderItem={({ item: member }) => (
                            <Radio
                              value={member.id}
                              size="lg"
                              className="justify-between p-4"
                            >
                              <HStack className="items-center gap-x-3 flex-1">
                                <AppAvatar
                                  name={member.first_name}
                                  uri={member.avatar ?? ""}
                                  size="md"
                                />
                                <VStack>
                                  <Text bold>
                                    {member.first_name} {member.last_name}
                                  </Text>
                                  <Text className="text-secondary-950 text-sm">
                                    {member.email}
                                  </Text>
                                </VStack>
                              </HStack>
                              <RadioIndicator>
                                <RadioIcon as={CircleIcon} />
                              </RadioIndicator>
                            </Radio>
                          )}
                          ItemSeparatorComponent={() => (
                            <Box className="mx-4">
                              <Divider className="border-secondary-200" />
                            </Box>
                          )}
                          ListEmptyComponent={() => (
                            <EmptyList type={EmptyType.MEMBER} />
                          )}
                        />
                      </RadioGroup>
                    </VStack>
                  </>
                ) : (
                  <Text>
                    Are you sure you want to leave{" "}
                    <Text bold>{groupDetails?.name}</Text>? You will no longer
                    have access to this group's expenses and settlements.
                  </Text>
                )}
              </LoadingWrapper>
            </VStack>
          </ScrollView>

          <Box className="items-center justify-center p-4">
            <HStack className="gap-x-2">
              <FormButton
                className="flex-1"
                variant="outline"
                text="Cancel"
                disabled={loading}
                onPress={onClose}
              />
              <ConfirmButton
                className="flex-1"
                action="negative"
                text="Leave Group"
                loading={loading}
                disabled={!canLeave}
                onConfirm={handleLeave}
                confirmTitle="Leave Group"
                confirmDescription={
                  isSoleAdmin
                    ? "This will permanently delete the group and all its data. Are you sure?"
                    : selectedNewAdmin
                      ? `Admin will be transferred to ${selectedNewAdmin.first_name} ${selectedNewAdmin.last_name}. Are you sure you want to leave?`
                      : "Are you sure you want to leave this group?"
                }
              />
            </HStack>
          </Box>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}

const SettlementItem = ({ item }: { item: Payment }) => {
  const { details: userDetails } = states.user();

  const isUserPayer = item.payer.id === userDetails?.id;
  const isUserMember = item.member.id === userDetails?.id;

  return (
    <HStack className="gap-x-2 items-start p-4">
      <SettlementAvatar isPayer={isUserPayer} />
      <VStack className="gap-y-2 flex-1">
        {item.expense_description && (
          <HStack className="gap-x-4 items-center flex-1">
            <Text
              className="text-secondary-950 uppercase flex-1"
              bold
              numberOfLines={1}
            >
              {item.expense_description}
            </Text>
            <Text className="text-secondary-950">
              {formatDate(item.created_at)}
            </Text>
          </HStack>
        )}
        <HStack className="gap-x-4">
          <VStack className="flex-1">
            <Text className="text-lg">
              {item.member.first_name} {item.member.last_name}
              {isUserMember && " (You)"}
            </Text>
            <Text className="text-sm text-secondary-950">pays</Text>
            <Text className="text-lg">
              {item.payer.first_name} {item.payer.last_name}
              {isUserPayer && " (You)"}
            </Text>
          </VStack>
          <HStack className="gap-x-2 items-center">
            <VStack className="items-end">
              <Text
                className={cn(
                  "text-lg",
                  isUserMember ? "text-error-400" : undefined
                )}
              >
                {isUserMember && "-"}
                {formatAmount(item.amount, item.currency)}
              </Text>
              <StatusBadge status={item.status} size="md" />
            </VStack>
          </HStack>
        </HStack>
      </VStack>
    </HStack>
  );
};
