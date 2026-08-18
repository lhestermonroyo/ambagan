import { useAppUpdate } from "@/hooks/useAppUpdate";
import { useOtaUpdate } from "@/hooks/useOtaUpdate";

/**
 * Headless mount point for both update paths — the silent OTA swap and the
 * store prompt. Kept out of the root layout component itself because
 * {@link useAppUpdate} subscribes to the root navigation state, and doing that
 * in RootLayout would re-render the entire tree on every navigation.
 *
 * Must live INSIDE the root Stack's provider tree so the prompt can navigate.
 */
export default function AppUpdateGate() {
  useOtaUpdate();
  useAppUpdate();
  return null;
}
