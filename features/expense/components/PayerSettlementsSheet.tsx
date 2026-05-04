import AppAvatar from "@/components/AppAvatar";
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
import { FlatList } from "@/components/ui/flat-list";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Payment } from "@/types/expenses";
import { Fragment, useState } from "react";
import { formatAmount } from "../utils/formatAmount";
import MarkAsSettledSheet from "./MarkAsSettledSheet";
import ReviewRequestPaidSheet from "./ReviewRequestPaidSheet";
import StatusBadge from "./StatusBadge";

export default function PayerSettlementsSheet({
  isOpen,
  onClose,
  payments,
  onRefetch
}: {
  isOpen: boolean;
  onClose: () => void;
  payments: Payment[];
  onRefetch: () => void;
}) {
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [markAsSettledSheetOpen, setMarkAsSettledSheetOpen] = useState(false);
  const [reviewSheetOpen, setReviewSheetOpen] = useState(false);
  const [reviewReadOnly, setReviewReadOnly] = useState(false);

  const handlePress = (payment: Payment) => {
    setSelectedPayment(payment);
    if (payment.status === "pending") {
      setMarkAsSettledSheetOpen(true);
    } else {
      setReviewReadOnly(payment.status === "settled");
      setReviewSheetOpen(true);
    }
  };

  return (
    <Fragment>
      <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[60]}>
        <ActionsheetBackdrop />
        <ActionsheetContent className="p-0">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <VStack className="w-full flex-1">
            <VStack className="p-4">
              <Text bold className="text-xl">
                My Settlements
              </Text>
            </VStack>
            <FlatList
              data={payments}
              keyExtractor={(item) => item.id}
              scrollEnabled={payments.length > 4}
              renderItem={({ item }) => (
                <PressableListItem onPress={() => handlePress(item)}>
                  <HStack className="p-4 gap-x-3 items-center">
                    <AppAvatar
                      name={item.member.first_name}
                      uri={item.member.avatar!}
                      size="md"
                    />
                    <VStack className="flex-1">
                      <Text className="text-lg">
                        {item.member.first_name} {item.member.last_name}
                      </Text>
                      <Text className="text-secondary-950 text-sm">
                        {item.member.email}
                      </Text>
                    </VStack>
                    <VStack className="items-end gap-y-1">
                      <Text className="text-lg">{formatAmount(item.amount)}</Text>
                      <StatusBadge status={item.status} size="lg" />
                    </VStack>
                  </HStack>
                </PressableListItem>
              )}
              ItemSeparatorComponent={() => (
                <Box className="mx-4">
                  <Divider className="border-secondary-100" />
                </Box>
              )}
              ListEmptyComponent={() => (
                <VStack className="items-center justify-center p-8">
                  <Text className="text-secondary-950">No settlements found.</Text>
                </VStack>
              )}
            />
          </VStack>
        </ActionsheetContent>
      </Actionsheet>

      {selectedPayment && (
        <MarkAsSettledSheet
          isOpen={markAsSettledSheetOpen}
          onClose={() => setMarkAsSettledSheetOpen(false)}
          payment={selectedPayment}
          onRefetch={onRefetch}
        />
      )}
      {selectedPayment && (
        <ReviewRequestPaidSheet
          isOpen={reviewSheetOpen}
          onClose={() => {
            setReviewSheetOpen(false);
            setReviewReadOnly(false);
          }}
          payment={selectedPayment}
          onRefetch={onRefetch}
          isPayer={true}
          readOnly={reviewReadOnly}
        />
      )}
    </Fragment>
  );
}
