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
import SettlementItem from "@/features/expense/components/SettlementItem";
import useAppToast from "@/hooks/use-app-toast";
import services from "@/services";
import states from "@/states";
import { Payment } from "@/types/expenses";
import { getErrorHex } from "@/utils/getColorHex";
import { AlertTriangle } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useColorScheme } from "react-native";

export default function DeleteAccountSheet({
  isOpen,
  onClose,
  onDelete
}: {
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => Promise<void>;
}) {
  const { details: userDetails } = states.user();
  const colorScheme = useColorScheme() ?? "light";

  const [fetching, setFetching] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [unsettledPayments, setUnsettledPayments] = useState<Payment[]>([]);

  const toast = useAppToast();

  useEffect(() => {
    if (isOpen && userDetails?.id) {
      fetchUnsettled();
    }
  }, [isOpen]);

  const fetchUnsettled = async () => {
    if (!userDetails?.id) return;
    setFetching(true);
    try {
      const payments = await services.expense.getUnsettledPaymentsByUserId(
        userDetails.id
      );
      setUnsettledPayments(payments);
    } catch (error) {
      console.error("Error fetching unsettled payments:", error);
    } finally {
      setFetching(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete();
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete account. Please try again.",
        type: "error"
      });
    } finally {
      setDeleting(false);
    }
  };

  const hasUnsettled = unsettledPayments.length > 0;
  const snapPoints = hasUnsettled ? [90] : [30];

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
              Delete Account
            </Text>
          </VStack>
          <ScrollView className="flex-1">
            <VStack className="gap-y-4">
              <LoadingWrapper isLoading={fetching}>
                {hasUnsettled ? (
                  <>
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
                        across your groups. Resolve all of them before deleting
                        your account.
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
                  </>
                ) : (
                  <Text className="px-4">
                    Are you sure you want to{" "}
                    <Text bold>permanently delete your account</Text>? All your
                    data — groups, expenses, and settlements — will be removed.
                    This cannot be undone.
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
                disabled={deleting}
                onPress={onClose}
              />
              {!fetching && !hasUnsettled && (
                <FormButton
                  className="flex-1"
                  action="negative"
                  text="Delete Account"
                  loading={deleting}
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
