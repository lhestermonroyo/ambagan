import NetInfo from "@react-native-community/netinfo";
import { useSyncExternalStore } from "react";

/**
 * A single app-wide NetInfo subscription shared by every `useNetwork()` caller.
 *
 * Previously each `useNetwork()` mount opened its own `NetInfo.addEventListener`.
 * Once connectivity-aware components like `AppAvatar` started rendering in lists,
 * that meant dozens of duplicate listeners and a re-render storm on every
 * connectivity change. This module keeps ONE listener for the app's lifetime and
 * fans the result out to subscribers via `useSyncExternalStore`.
 */

let online = true;
let started = false;
const listeners = new Set<() => void>();

const emit = (next: boolean) => {
  if (next === online) return;
  online = next;
  listeners.forEach((l) => l());
};

// Lazily start the single subscription the first time anyone subscribes. The
// listener is intentionally never torn down — connectivity is app-global state.
const ensureStarted = () => {
  if (started) return;
  started = true;
  NetInfo.fetch().then((state) => emit(state.isConnected ?? true));
  NetInfo.addEventListener((state) => emit(state.isConnected ?? true));
};

const subscribe = (cb: () => void) => {
  ensureStarted();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

const getSnapshot = () => online;

export function useNetwork() {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot);
  return { isOnline };
}
