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
import { formatDate } from "@/utils/formatDate";
import { getErrorHex } from "@/utils/getColorHex";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { AlertTriangle } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useColorScheme } from "react-native";

export default function DeleteGroupSheet({
  isOpen,
  onClose,
  onDelete
}: {
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => Promise<void>;
}) {
  const { details: groupDetails } = states.group.getState();
  const colorScheme = useColorScheme() ?? "light";

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [unsettledPayments, setUnsettledPayments] = useState<Payment[]>([]);

  const toast = useAppToast();

  useEffect(() => {
    if (isOpen && groupDetails?.id) {
      setUnsettledPayments([]);
      fetchUnsettled();
    }
  }, [isOpen]);

  const fetchUnsettled = async () => {
    if (!groupDetails?.id) return;
    setFetching(true);
    try {
      const payments = await services.expense.getUnsettledPaymentsByGroupId(
        groupDetails.id
      );
      setUnsettledPayments(payments);
    } catch (error) {
      console.error("Error fetching unsettled payments:", error);
    } finally {
      setFetching(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await onDelete();
    } catch (error: any) {
      toast({
        title: "Cannot delete group",
        description:
          error?.message ?? "Failed to delete group. Please try again.",
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const hasUnsettled = unsettledPayments.length > 0;
  const snapPoints = hasUnsettled ? [90] : [35];

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
              Delete Group
            </Text>
          </VStack>
          <ScrollView className="flex-1">
            <LoadingWrapper isLoading={fetching}>
              <VStack className="gap-y-4">
                {hasUnsettled ? (
                  <>
                    <HStack className="bg-error-50 rounded-xl gap-x-4 p-4 mx-4 items-start">
                      <AlertTriangle
                        color={getErrorHex("text-error-600", colorScheme)}
                      />
                      <Text className="text-error-600 flex-1">
                        This group has{" "}
                        <Text bold className="text-error-600">
                          {unsettledPayments.length} unsettled{" "}
                          {unsettledPayments.length === 1
                            ? "payment"
                            : "payments"}
                        </Text>
                        . Settle all expenses before deleting the group.
                      </Text>
                    </HStack>
                    <FlatList
                      className="rounded-xl overflow-hidden"
                      scrollEnabled={false}
                      data={unsettledPayments}
                      keyExtractor={(item) => item.id}
                      renderItem={({ item }) => (
                        <DeleteSettlementItem item={item} />
                      )}
                      ItemSeparatorComponent={() => (
                        <Box className="mx-4">
                          <Divider className="border-secondary-200" />
                        </Box>
                      )}
                    />
                  </>
                ) : (
                  <Text className="px-4">
                    Are you sure you want to permanently delete{" "}
                    <Text bold>{groupDetails?.name}</Text>? This will remove all
                    expenses, settlements, and member data. This cannot be
                    undone.
                  </Text>
                )}
              </VStack>
            </LoadingWrapper>
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
                  text="Delete"
                  action="negative"
                  loading={loading}
                  onPress={handleDelete}
                />
              )}
            </HStack>
          </Box>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}

const DeleteSettlementItem = ({ item }: { item: Payment }) => {
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
              className="text-sm text-secondary-950 uppercase flex-1"
              bold
              numberOfLines={1}
            >
              {item.expense_description}
            </Text>
            <Text className="text-sm text-secondary-950">
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
