import { Stack } from "expo-router";

// No header here, unlike the other tab stacks: the scanner is a full-bleed
// camera with its own overlay controls.
export default function ScanReceiptStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
