import CategoryIcon from "@/components/CategoryIcon";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { bookEntryCurrency } from "@/features/book/utils/bookCurrency";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import { Book } from "@/types/books";
import { categories, currencies } from "@/utils/constants";
import { formatDate } from "@/utils/formatDate";
import { getPrimaryHex } from "@/utils/getColorHex";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import React, { Fragment, useMemo } from "react";
import { useColorScheme } from "react-native";

export default function BookInfoTab({ book }: { book: Book }) {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";

  const category = useMemo(
    () => categories.find((c) => c.value === book.category) ?? null,
    [book.category]
  );

  const currency = useMemo(
    () => currencies.find((c) => c.value === book.currency) ?? null,
    [book.currency]
  );

  // Only interesting when it differs from the book's own currency — on every
  // other book it would restate the row above it.
  const entryCurrency = useMemo(() => {
    const resolved = bookEntryCurrency({
      currency: book.currency,
      default_expense_currency: book.default_expense_currency
    });
    if (!resolved || resolved === book.currency) return null;
    return currencies.find((c) => c.value === resolved) ?? null;
  }, [book.default_expense_currency, book.currency]);

  return (
    <Fragment>
      <VStack className="gap-y-6 px-4 pb-6">
        <Box className="bg-secondary-100 rounded-xl overflow-hidden">
          <DetailRow
            label={entryCurrency ? "Book currency" : "Currency"}
            value={
              <Text>
                {currency ? currency.subtitle : book.currency} (
                {currency?.sign ?? book.currency})
              </Text>
            }
          />
          {entryCurrency && (
            <>
              <RowDivider />
              <DetailRow
                label="New expenses"
                value={
                  <Text>
                    {entryCurrency.subtitle} ({entryCurrency.sign})
                  </Text>
                }
              />
            </>
          )}
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
          {book.group_id && (
            <>
              <RowDivider />
              <DetailRow
                label="Linked group"
                value={
                  <Pressable
                    onPress={() => router.push(`/groups/${book.group_id}`)}
                  >
                    <HStack className="items-center gap-x-2">
                      {/* The group name comes from a join that returns null once
                          the owner leaves the group — the link is still real, we
                          just can't name it, so say so rather than showing
                          nothing. */}
                      <Text className="text-sm">
                        {book.linked_group?.name ?? "View group"}
                      </Text>
                      <ChevronRight
                        size={16}
                        color={getPrimaryHex("text-primary-500", colorScheme)}
                      />
                    </HStack>
                  </Pressable>
                }
              />
            </>
          )}
          {book.budget != null && (
            <>
              <RowDivider />
              <DetailRow
                label={
                  book.budget_period === "total"
                    ? "Total budget"
                    : "Monthly budget"
                }
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
