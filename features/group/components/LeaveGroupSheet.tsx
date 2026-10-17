import { useEmptyStatePreview } from "@/hooks/useEmptyStatePreview";
import AppAvatar from "@/components/AppAvatar";
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
import SettlementItem from "@/features/expense/components/SettlementItem";
import useAppToast from "@/hooks/use-app-toast";
import services from "@/services";
import states from "@/states";
import { Payment } from "@/types/expenses";
import { EmptyType } from "@/types/general";
import { GroupRole, Member } from "@/types/groups";
import { isGroupOwner } from "@/features/group/utils/groupRoles";
import { getErrorHex, getPrimaryHex } from "@/utils/getColorHex";
import * as offlineQueue from "@/utils/offlineQueue";
import { getUserSubtitle } from "@/utils/userDisplay";
import { AlertTriangle, CircleIcon } from "lucide-react-native";
import { Fragment, useEffect, useMemo, useState } from "react";
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
  const previewEmpty = useEmptyStatePreview();
  const { details: groupDetails, memberList } = states.group.getState();
  const { details: userDetails } = states.user();
  const colorScheme = useColorScheme() ?? "light";

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [unsettledPayments, setUnsettledPayments] = useState<Payment[]>([]);
  const [selectedNewAdmin, setSelectedNewAdmin] = useState<Member | null>(null);

  const toast = useAppToast();

  // Only the OWNER has to hand the group over. A co-admin leaving is an
  // ordinary departure — the group keeps its owner and its other admins.
  const isOwner = isGroupOwner(groupDetails, userDetails?.id);
  // Existing admins first: they already manage the group, so they're the
  // natural successors to offer at the top of the transfer list.
  const otherMembers = useMemo(
    () =>
      memberList
        .filter((m) => m.id !== userDetails?.id)
        .sort(
          (a, b) =>
            Number(b.role === GroupRole.ADMIN) -
            Number(a.role === GroupRole.ADMIN)
        ),
    [memberList, userDetails?.id]
  );
  const isSoleMember = isOwner && otherMembers.length === 0;

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

    // Leaving reassigns admin / may delete the group and notify members — it
    // needs a live connection, so it isn't supported offline.
    if (!(await offlineQueue.isOnline())) {
      toast({
        title: "You're offline",
        description: "Leaving a group requires an internet connection.",
        type: "error"
      });
      return;
    }

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
  const adminNeedsSelection = isOwner && !isSoleMember && !selectedNewAdmin;
  const canLeave = !fetching && !hasUnsettled && !adminNeedsSelection;
  const snapPoints = hasUnsettled || (isOwner && !isSoleMember) ? [90] : [30];

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
                        color={getErrorHex(
                          colorScheme === "dark" ? "text-error-800" : "text-error-600",
                          colorScheme
                        )}
                      />
                      <Text className="text-error-600 flex-1 dark:text-error-800">
                        You have{" "}
                        <Text bold className="text-error-600 dark:text-error-800">
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
                ) : isSoleMember ? (
                  <HStack className="bg-primary-50 rounded-xl gap-x-3 p-4 items-start">
                    <AlertTriangle
                      color={getPrimaryHex(
                        colorScheme === "dark" ? "text-primary-800" : "text-primary-600",
                        colorScheme
                      )}
                    />
                    <Text className="text-primary-600 flex-1 dark:text-primary-800">
                      You are the only member. Leaving will{" "}
                      <Text bold className="text-primary-600 dark:text-primary-800">
                        permanently delete this group
                      </Text>{" "}
                      and all its data.
                    </Text>
                  </HStack>
                ) : isOwner ? (
                  <VStack className="px-4 gap-y-4">
                    <HStack className="bg-primary-50 rounded-xl gap-x-3 p-4 items-start">
                      <AlertTriangle
                        size={18}
                        color={getPrimaryHex(
                          colorScheme === "dark" ? "text-primary-800" : "text-primary-600",
                          colorScheme
                        )}
                      />
                      <Text className="text-primary-600 flex-1 dark:text-primary-800">
                        You own this group. Pick who takes over as owner
                        before you leave.
                      </Text>
                    </HStack>

                    <VStack className="gap-y-1">
                      <Text className="font-medium">Transfer ownership to</Text>
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
                          data={previewEmpty ? [] : otherMembers}
                          keyExtractor={(item) => item.id}
                          renderItem={({ item: member }) => (
                            <Radio
                              value={member.id}
                              size="md"
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
                                    {member.role === GroupRole.ADMIN
                                      ? "Admin"
                                      : getUserSubtitle(member)}
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
                            <EmptyList
                              type={EmptyType.MEMBER}
                              content="No one to transfer ownership to. Add another member before leaving."
                            />
                          )}
                        />
                      </RadioGroup>
                    </VStack>
                  </VStack>
                ) : (
                  <Text className="px-4">
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
              {!fetching && !hasUnsettled && (
                <FormButton
                  className="flex-1"
                  action="negative"
                  text={isSoleMember ? "Delete Group" : "Leave Group"}
                  loading={loading}
                  disabled={!canLeave}
                  onPress={handleLeave}
                />
              )}
            </HStack>
          </Box>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
