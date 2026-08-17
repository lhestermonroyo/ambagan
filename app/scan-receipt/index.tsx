import ScanReceiptView from "@/features/expense/components/ScanReceiptView";

// Scanner opened from the home net balance card's action buttons. Nothing is
// pre-selected, so the scan hands off to ./destination, where the user picks the
// group or book it belongs to. It's a top-level route (not a tab) so it stacks
// *over* Home with its own close button, and the picker and form stack on top of
// it in turn — backing out of either returns here with the receipt still held.
export default function ScanReceiptScreen() {
  return <ScanReceiptView presentation="pushed" />;
}
