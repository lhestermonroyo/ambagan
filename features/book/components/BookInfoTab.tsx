import CategoryIcon from "@/components/CategoryIcon";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import { Book } from "@/types/books";
import { categories, currencies } from "@/utils/constants";
import { formatDate } from "@/utils/formatDate";
import React, { Fragment, useMemo } from "react";

export default function BookInfoTab({ book }: { book: Book }) {
  const category = useMemo(
    () => categories.find((c) => c.value === book.category) ?? null,
    [book.category]
  );

  const currency = useMemo(
    () => currencies.find((c) => c.value === book.currency) ?? null,
    [book.currency]
  );

  return (
    <Fragment>
      <VStack className="gap-y-6 px-4 pb-6">
        <Box className="bg-secondary-100 rounded-xl overflow-hidden">
          <DetailRow
            label="Currency"
            value={
              <Text>
                {currency ? currency.subtitle : book.currency} (
                {currency?.sign ?? book.currency})
              </Text>
            }
          />
          <RowDivider />
          <DetailRow
            label="Category"
            value={
              category ? (
                <HStack className="items-center gap-x-3">
                  <CategoryIcon icon={category.icon} size={16} />
                  <Text className="text-sm">{category.label}</Text>
                </HStack>
              ) : (
                <Text className="text-sm">-</Text>
              )
            }
          />
          <RowDivider />
          <DetailRow
            label="Expenses"
            value={
              <Text>
                {book.expense_count}{" "}
                {book.expense_count === 1 ? "expense" : "expenses"}
              </Text>
            }
          />
          {book.budget != null && (
            <>
              <RowDivider />
              <DetailRow
                label="Monthly budget"
                value={<Text>{formatAmount(book.budget, book.currency)}</Text>}
              />
            </>
          )}
          <RowDivider />
          <DetailRow
            label="Created at"
            value={<Text>{formatDate(book.created_at || "")}</Text>}
          />
          <RowDivider />
          <DetailRow
            label="Status"
            value={
              <Badge
                size="sm"
                action={book.archived ? "muted" : "success"}
                variant="solid"
              >
                <BadgeText>{book.archived ? "Archived" : "Active"}</BadgeText>
              </Badge>
            }
          />
        </Box>
      </VStack>
    </Fragment>
  );
}

const RowDivider = () => (
  <Box className="mx-4">
    <Divider className="border-secondary-200" />
  </Box>
);

const DetailRow = ({
  label,
  value
}: {
  label: string;
  value: React.ReactNode;
}) => {
  return (
    <HStack className="items-center justify-between p-4">
      <Text className="text-secondary-950">{label}</Text>
      {value}
    </HStack>
  );
};
