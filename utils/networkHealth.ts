/**
 * Tracks whether reads are currently timing out — i.e. the device is "online"
 * per NetInfo but the network is effectively dead/slow (captive portals, weak
 * signal, server stalls), so requests hang instead of failing fast.
 *
 * The Supabase read-timeout fetch (utils/supabase.ts) flips this:
 *  - a read that aborts on timeout  → markConnectionSlow()
 *  - a read that succeeds           → markConnectionHealthy()
 *
 * It's a single app-wide flag fanned out to subscribers via useSyncExternalStore
 * (see hooks/useNetworkHealth.ts), the same pattern as useNetwork.
 */

// How long a READ may hang before we abort it and fall back to cached data.
export const READ_TIMEOUT_MS = 10000;

let degraded = false;
const listeners = new Set<() => void>();

const emit = (next: boolean) => {
  if (next === degraded) return;
  degraded = next;
  listeners.forEach((l) => l());
};

export const markConnectionSlow = () => emit(true);
export const markConnectionHealthy = () => emit(false);

export const subscribeNetworkHealth = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export const getNetworkHealthSnapshot = () => degraded;
