import { useSyncExternalStore } from "react";

// Display-only, session-local state. Never persisted or written to app stores.
let enabled = false;
const listeners = new Set<() => void>();
const getSnapshot = () => __DEV__ && enabled;
const getServerSnapshot = () => false;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function setEmptyStatePreview(value: boolean) {
  if (!__DEV__ || enabled === value) return;
  enabled = value;
  listeners.forEach((listener) => listener());
}

export function useEmptyStatePreview() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
