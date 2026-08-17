import ScanReceiptView from "@/features/expense/components/ScanReceiptView";
import { useLocalSearchParams } from "expo-router";

// Scanner opened from a book's FAB. Routed under the book (not the Scan tab) so
// it stacks *over* the book details; the parsed receipt hands off to that book's
// personal Add Expense form.
export default function BookScanReceiptScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();

  return <ScanReceiptView bookId={bookId} presentation="pushed" />;
}
