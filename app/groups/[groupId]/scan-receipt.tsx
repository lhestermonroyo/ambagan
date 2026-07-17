import ScanReceiptView from "@/features/expense/components/ScanReceiptView";
import { useLocalSearchParams } from "expo-router";

// Scanner opened from a group's FAB. It's a route under the group rather than
// the Scan tab so it stacks *over* the group details — routing this through the
// tab would drop the group from the stack and land you back on Groups.
export default function GroupScanReceiptScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();

  return <ScanReceiptView groupId={groupId} presentation="pushed" />;
}
