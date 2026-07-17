import ScanReceiptView from "@/features/expense/components/ScanReceiptView";

// The Scan tab: no group pre-selected — the form picks one.
export default function ScanReceiptTabScreen() {
  return <ScanReceiptView presentation="tab" />;
}
