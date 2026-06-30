import {
  getNetworkHealthSnapshot,
  subscribeNetworkHealth
} from "@/utils/networkHealth";
import { useSyncExternalStore } from "react";

/**
 * `isDegraded` is true when the device is online but reads are timing out
 * (slow/hung network), so the UI can show "showing saved data" instead of an
 * infinite spinner. Distinct from `useNetwork().isOnline` (true-offline).
 */
export function useNetworkHealth() {
  const isDegraded = useSyncExternalStore(
    subscribeNetworkHealth,
    getNetworkHealthSnapshot
  );
  return { isDegraded };
}
