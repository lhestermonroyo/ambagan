import AppAvatar from "@/components/AppAvatar";
import ConfirmButton from "@/components/ConfirmButton";
import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import PressableListItem from "@/components/PressableListItem";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import StatusBadge from "@/features/expense/components/StatusBadge";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import useAppToast from "@/hooks/use-app-toast";
import services from "@/services";
import states from "@/states";
import { Payment } from "@/types/expenses";
import { Member } from "@/types/groups";
import { getSecondaryHex } from "@/utils/getColorHex";
import { AlertTriangle, LogOut } from "lucide-react-native";
import { useEffect, useState } from "react";

const ERROR_HEX = "#DC2626";
const WARNING_HEX = "#D97706";

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
  const { details: userDetails } = states.user.getState();

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

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[80]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-0">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack className="w-full flex-1">
          <HStack className="items-center gap-x-2 p-4">
            <LogOut size={20} color={getSecondaryHex("text-secondary-950")} />
            <Text bold className="text-xl">
              Leave Group
            </Text>
          </HStack>

          <ScrollView className="flex-1 px-4" bounces={false}>
            <VStack className="gap-y-4">
              {fetching ? (
                <Box className="py-8 items-center">
                  <Text className="text-secondary-950">
                    Checking your settlements...
                  </Text>
                </Box>
              ) : hasUnsettled ? (
                <>
                  <HStack className="bg-error-50 rounded-xl gap-x-3 p-4 items-start">
                    <AlertTriangle size={18} color={ERROR_HEX} />
                    <Text className="text-error-600 flex-1">
                      You have{" "}
                      <Text bold className="text-error-600">
                        {unsettledPayments.length} unsettled{" "}
                        {unsettledPayments.length === 1 ? "payment" : "payments"}
                      </Text>{" "}
                      in this group. Resolve all of them before leaving.
                    </Text>
                  </HStack>

                  <VStack className="bg-secondary-100 rounded-xl overflow-hidden">
                    {unsettledPayments.map((p, i) => (
                      <VStack key={p.id}>
                        <HStack className="p-4 items-center justify-between">
                          <HStack className="gap-x-2 items-center flex-1">
                            <AppAvatar
                              name={
                                p.member.id === userDetails?.id
                                  ? p.payer.first_name
                                  : p.member.first_name
                              }
                              uri={
                                (p.member.id === userDetails?.id
                                  ? p.payer.avatar
                                  : p.member.avatar) ?? ""
                              }
                              size="sm"
                            />
                            <VStack>
                              <Text className="text-sm text-secondary-950">
                                {p.member.id === userDetails?.id
                                  ? `You owe ${p.payer.first_name} ${p.payer.last_name}`
                                  : `${p.member.first_name} ${p.member.last_name} owes you`}
                              </Text>
                              <Text bold>{formatAmount(p.amount)}</Text>
                            </VStack>
                          </HStack>
                          <StatusBadge status={p.status} size="lg" />
                        </HStack>
                        {i < unsettledPayments.length - 1 && (
                          <Box className="mx-4">
                            <Divider className="border-secondary-200" />
                          </Box>
                        )}
                      </VStack>
                    ))}
                  </VStack>
                </>
              ) : isSoleAdmin ? (
                <HStack className="bg-warning-50 rounded-xl gap-x-3 p-4 items-start">
                  <AlertTriangle size={18} color={WARNING_HEX} />
                  <Text className="text-warning-600 flex-1">
                    You are the only member. Leaving will{" "}
                    <Text bold className="text-warning-600">
                      permanently delete this group
                    </Text>{" "}
                    and all its data.
                  </Text>
                </HStack>
              ) : isAdmin ? (
                <>
                  <HStack className="bg-warning-50 rounded-xl gap-x-3 p-4 items-start">
                    <AlertTriangle size={18} color={WARNING_HEX} />
                    <Text className="text-warning-600 flex-1">
                      You are the group admin. Select a member to transfer admin
                      to before leaving.
                    </Text>
                  </HStack>

                  <VStack className="gap-y-1">
                    <Text bold className="text-sm text-secondary-950">
                      Transfer admin to
                    </Text>
                    <VStack className="bg-secondary-100 rounded-xl overflow-hidden">
                      {otherMembers.map((member, i) => {
                        const isSelected = selectedNewAdmin?.id === member.id;
                        return (
                          <VStack key={member.id}>
                            <PressableListItem
                              className="p-4"
                              onPress={() =>
                                setSelectedNewAdmin(
                                  isSelected ? null : member
                                )
                              }
                            >
                              <HStack className="items-center gap-x-3">
                                <AppAvatar
                                  name={member.first_name}
                                  uri={member.avatar ?? ""}
                                  size="md"
                                />
                                <VStack className="flex-1">
                                  <Text bold>
                                    {member.first_name} {member.last_name}
                                  </Text>
                                  <Text className="text-secondary-950 text-sm">
                                    {member.email}
                                  </Text>
                                </VStack>
                                {isSelected && (
                                  <Icon
                                    as="check"
                                    className="text-primary-500"
                                  />
                                )}
                              </HStack>
                            </PressableListItem>
                            {i < otherMembers.length - 1 && (
                              <Box className="mx-4">
                                <Divider className="border-secondary-200" />
                              </Box>
                            )}
                          </VStack>
                        );
                      })}
                    </VStack>
                  </VStack>
                </>
              ) : (
                <Text className="text-secondary-950">
                  Are you sure you want to leave{" "}
                  <Text bold>{groupDetails?.name}</Text>? You will no longer
                  have access to this group's expenses and settlements.
                </Text>
              )}
            </VStack>
          </ScrollView>

          <Box className="px-4 pb-4">
            <Box className="h-4" />
            <HStack className="gap-x-2">
              <FormButton
                className="flex-1"
                variant="outline"
                text="Cancel"
                disabled={loading}
                onPress={onClose}
              />
              {canLeave && (
                <ConfirmButton
                  className="flex-1"
                  action="negative"
                  text="Leave Group"
                  loading={loading}
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
              )}
            </HStack>
          </Box>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
