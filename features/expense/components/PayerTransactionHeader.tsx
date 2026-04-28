import AppAvatar from "@/components/AppAvatar";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import { Expense, ExpenseSplit } from "@/types/expenses";
import { formatDate } from "@/utils/formatDate";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { Fragment, useState } from "react";
import RequestPaidSheet from "./RequestPaidSheet";
import ReviewRequestPaidSheet from "./ReviewRequestPaidSheet";

export default function PayerTransactionHeader({
  expense,
  currentUserSplit,
  totalPaid,
  theyOweYouAmount,
  onRefetch
}: {
  expense: Expense;
  currentUserSplit: ExpenseSplit;
  totalPaid: number;
  theyOweYouAmount: number;
  onRefetch: () => void;
}) {
  const [requestPaidSheetOpen, setRequestPaidSheetOpen] = useState(false);
  const [reviewRequestPaidSheetOpen, setReviewRequestPaidSheetOpen] =
    useState(false);

  return (
    <Fragment>
      <VStack className="gap-y-6 pb-2">
        <VStack className="w-full gap-y-6 px-4">
          <VStack className="items-center">
            {/* <Box className="mb-2">
              <StatusBadge status="payer" size="lg" />
            </Box> */}
            <Text className="text-xl" bold>
              {expense?.description}
            </Text>
            <HStack className="gap-x-1 items-center">
              <Text className="text-secondary-950">Paid by</Text>
              <AppAvatar
                name={expense?.paid_by.first_name || ""}
                uri={expense?.paid_by.avatar || ""}
                size="xs"
              />
              <Text className="text-secondary-950">
                {expense?.paid_by.first_name} {expense?.paid_by.last_name}
              </Text>
              <Text>&bull;</Text>
              <Text className="text-secondary-950">
                {formatDate(expense?.created_at || "")}
              </Text>
            </HStack>
          </VStack>
          <HStack className="gap-x-4">
            <VStack className="flex-1 items-center">
              <Text className="text-2xl" bold>
                {formatAmount(expense?.amount || 0)}
              </Text>
              <Text className="text-secondary-950 text-sm">Total Amount</Text>
            </VStack>

            <VStack className="flex-1 items-center">
              <Text className="text-2xl" bold>
                {formatAmount(theyOweYouAmount || 0)}
              </Text>
              <Text className="text-secondary-950 text-sm">They owe you</Text>
            </VStack>

            <VStack className="flex-1 items-center">
              <Text
                className={cn(
                  "text-2xl",
                  theyOweYouAmount <= totalPaid
                    ? "text-green-500"
                    : "text-error-400"
                )}
                bold
              >
                {formatAmount(totalPaid || 0)}
              </Text>
              <Text className="text-secondary-950 text-sm">Total Paid</Text>
            </VStack>
          </HStack>
        </VStack>

        <Text className="text-lg px-4" bold>
          Expense Splits
        </Text>
      </VStack>
      <RequestPaidSheet
        isOpen={requestPaidSheetOpen}
        onClose={() => setRequestPaidSheetOpen(false)}
        onRefetch={onRefetch}
        expenseSplit={currentUserSplit}
      />
      <ReviewRequestPaidSheet
        isOpen={reviewRequestPaidSheetOpen}
        onClose={() => setReviewRequestPaidSheetOpen(false)}
        onRefetch={onRefetch}
        expenseSplit={currentUserSplit}
      />
    </Fragment>
  );
}
