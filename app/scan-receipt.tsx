import ScanReceiptView from "@/features/expense/components/ScanReceiptView";

// Scanner opened from the home net balance card's action buttons. No group is
// pre-selected — the Add Expense form picks one. It's a top-level route (not a
// tab) so it stacks *over* Home with its own close button; backing out of the
// form it hands off to returns here, then to Home.
export default function ScanReceiptScreen() {
  return <ScanReceiptView presentation="pushed" />;
}
