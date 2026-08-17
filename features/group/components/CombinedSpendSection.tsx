import BookPickerSheet from "@/features/book/components/BookPickerSheet";
import PressableListItem from "@/components/PressableListItem";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { formatAmount } from "@/features/expense/utils/formatAmount";
import {
  combinedTotalLabel,
  useLinkedBookTotals
} from "@/features/group/hooks/useCombinedSpend";
import useAppToast from "@/hooks/use-app-toast";
import services from "@/services";
import states from "@/states";
import { Book } from "@/types/books";
import { getPrimaryHex } from "@/utils/getColorHex";
import { useRouter } from "expo-router";
import { BookPlus, Lock } from "lucide-react-native";
import { useState } from "react";
import { useColorScheme } from "react-native";

/**
 * "What did this actually cost me" — the current user's group share plus the
 * spending in their LINKED personal book, on the group's Stats tab.
 *
 * A trip's shared dinners live in the group and the solo souvenirs in a personal
 * book; at the end of the trip neither surface answers the real question. Linking
 * the two lets this add them up. The link is display-only — personal expenses
 * stay in the owner-only tables and never touch splits, balances, or settlement.
 *
 * The two halves are always rendered as lines that visibly sum rather than one
 * blended figure: a user who also logged their share of a shared expense in their
 * book has double-counted it, and only a breakdown makes that visible.
 */
export default function CombinedSpendSection({
  groupId,
  groupCategory,
  targetCurrency,
  yourShare,
  shareApprox,
  shareLoading,
  cutoff,
  until
}: {
  groupId: string;
  groupCategory?: string;
  /** The group's own currency — both halves are expressed in it. */
  targetCurrency: string;
  /** The user's share of the group's splits, already converted by the caller. */
  yourShare: number;
  shareApprox: boolean;
  shareLoading: boolean;
  cutoff: Date | null;
  until: Date | null;
}) {
  const router = useRouter();
  const toast = useAppToast();
  const colorScheme = useColorScheme() ?? "light";
  const { details: userDetails } = states.user();

  const { book, paid, pending, loading, refresh } = useLinkedBookTotals(
    groupId,
    cutoff,
    until,
    targetCurrency
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  const [linkable, setLinkable] = useState<Book[]>([]);
  const [linking, setLinking] = useState(false);

  // Books are fetched on demand rather than read from the books state: a user who
  // opened a group without ever visiting the Books tab has an empty list there,
  // and the CTA would wrongly look like "you have no books".
  const openPicker = async () => {
    if (!userDetails?.id) return;
    setLinking(true);
    try {
      const books = await services.book.getBooksByUserId(userDetails.id);
      const available = books.filter((b) => !b.group_id);
      if (available.length === 0) {
        router.push("/books/create");
        return;
      }
      setLinkable(available);
      setPickerOpen(true);
    } catch {
      toast({
        title: "Couldn't load your books",
        description: "Check your connection and try again.",
        type: "error"
      });
    } finally {
      setLinking(false);
    }
  };

  const handleLink = async (selected: Book) => {
    setPickerOpen(false);
    try {
      await services.book.linkBookToGroup(selected.id, groupId);
      toast({
        title: "Book linked",
        description: `${selected.name} now rolls up with this group.`,
        type: "success"
      });
      refresh();
    } catch (error) {
      toast({
        title: "Couldn't link book",
        description:
          error instanceof Error ? error.message : "Please try again.",
        type: "error"
      });
    }
  };

  // No book linked — offer it rather than assuming it. Auto-creating a book for
  // every group a user joins would clutter the Books tab of everyone who will
  // never use this.
  if (!loading && !book) {
    return (
      <>
        <Divider />
        <PressableListItem
          className="p-4 border border-background-200 rounded-lg"
          disabled={linking}
          onPress={openPicker}
        >
          <HStack className="gap-x-4 items-center">
            <VStack className="flex-1">
              <Text className="text-lg">Link a personal book</Text>
              <Text className="text-sm text-secondary-950">
                Tracking your own spending here too? Link a book to see what this{" "}
                {groupCategory === "trip" ? "trip" : "group"} really cost you.
              </Text>
            </VStack>
            <BookPlus
              size={20}
              color={getPrimaryHex("text-primary-500", colorScheme)}
            />
          </HStack>
        </PressableListItem>
      </>
    );
  }

  const combined = yourShare + paid.amount;
  const combinedApprox = shareApprox || paid.approx;
  const busy = loading || shareLoading;

  return (
    <>
      <BookPickerSheet
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        books={linkable}
        onSelect={handleLink}
        title="Link which book?"
      />

      <Divider />

      <VStack className="gap-y-3">
        <HStack className="items-center gap-x-2">
          <Text bold className="text-secondary-950 uppercase text-sm">
            {combinedTotalLabel(groupCategory)}
          </Text>
          <Lock size={12} color={getPrimaryHex("text-primary-500", colorScheme)} />
        </HStack>

        {/* Two lines that add up. Never collapsed into one figure — see the
            component doc: the breakdown is what makes a double-logged expense
            findable. */}
        <VStack className="gap-y-2">
          <BreakdownRow
            label="Your share (group)"
            amount={yourShare}
            currency={targetCurrency}
            approx={shareApprox}
            loading={shareLoading}
          />
          <BreakdownRow
            label={`Personal (${book?.name ?? "book"})`}
            amount={paid.amount}
            currency={targetCurrency}
            approx={paid.approx}
            loading={loading}
          />
          <Divider />
          <HStack className="items-center justify-between">
            <Text bold>{combinedTotalLabel(groupCategory)}</Text>
            <Text bold className="text-lg" numberOfLines={1} adjustsFontSizeToFit>
              {busy
                ? "—"
                : `${combinedApprox ? "≈ " : ""}${formatAmount(combined, targetCurrency)}`}
            </Text>
          </HStack>
        </VStack>

        {/* Pending bills aren't money out yet, so they sit outside the total
            rather than inflating it — same call the book's own Stats tab makes. */}
        {!busy && pending.amount > 0 && (
          <Text className="text-sm text-secondary-950">
            {`Plus ${pending.approx ? "≈ " : ""}${formatAmount(pending.amount, targetCurrency)} in unpaid personal bills.`}
          </Text>
        )}

        <Text className="text-sm text-secondary-950">
          Only you can see your personal spending. The two lines are counted
          separately — don&apos;t log your share of a shared expense in your book
          as well.
        </Text>
      </VStack>
    </>
  );
}

function BreakdownRow({
  label,
  amount,
  currency,
  approx,
  loading
}: {
  label: string;
  amount: number;
  currency: string;
  approx: boolean;
  loading: boolean;
}) {
  return (
    <HStack className="items-center justify-between gap-x-3">
      <Text className="text-sm text-secondary-950 flex-1" numberOfLines={1}>
        {label}
      </Text>
      <Text numberOfLines={1} adjustsFontSizeToFit>
        {loading ? "—" : `${approx ? "≈ " : ""}${formatAmount(amount, currency)}`}
      </Text>
    </HStack>
  );
}
