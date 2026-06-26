import { useOfflineSync } from "@/hooks/useOfflineSync";

/**
 * Headless mount point for the offline write-queue sync. Must live inside the
 * ToastProvider so the sync hook can surface its result toasts.
 */
export default function OfflineSync() {
  useOfflineSync();
  return null;
}
