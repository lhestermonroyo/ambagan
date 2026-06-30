import { createClient } from '@supabase/supabase-js';
import 'expo-sqlite/localStorage/install';
import { Platform } from 'react-native';
import {
  markConnectionHealthy,
  markConnectionSlow,
  READ_TIMEOUT_MS
} from './networkHealth';

const supabaseUrl = process.env.EXPO_PUBLIC_SB_URL as string;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SB_API_KEY as string;

const getMethod = (input: RequestInfo | URL, init?: RequestInit): string => {
  if (init?.method) return init.method.toUpperCase();
  if (typeof input !== 'string' && !(input instanceof URL) && 'method' in input) {
    return (input as Request).method.toUpperCase();
  }
  return 'GET';
};

const getUrl = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return (input as Request).url;
};

/**
 * Times out hung READS so they fall back to cached data instead of spinning
 * forever when the device is "online" but the network is dead/slow (captive
 * portals, weak signal, server stalls). On timeout the request aborts → throws
 * → the services' existing `catch → read cache` paths take over.
 *
 * Scope is deliberate — only GET requests to non-auth endpoints are timed out:
 *  - WRITES (POST/PATCH/DELETE) pass through untouched: a slow-but-succeeding
 *    write must never be aborted, or a retry could double-apply it.
 *  - AUTH (`/auth/v1/…`, e.g. token refresh) passes through: aborting it could
 *    spuriously sign the user out.
 *  - Requests that already carry an abort signal are respected as-is.
 */
const timeoutFetch: typeof fetch = async (input, init) => {
  const isRead = getMethod(input, init) === 'GET';
  const isAuth = getUrl(input).includes('/auth/v1/');

  if (!isRead || isAuth || init?.signal) {
    return fetch(input, init);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), READ_TIMEOUT_MS);
  try {
    const res = await fetch(input, { ...init, signal: controller.signal });
    markConnectionHealthy();
    return res;
  } catch (error) {
    // Aborted = our timeout fired (online but hung) → flag degraded so the UI
    // can show "showing saved data". A true-offline error (fails fast, not
    // aborted) is handled by NetInfo instead, so we don't flag it here.
    if (controller.signal.aborted) markConnectionSlow();
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: Platform.OS !== 'web' ? localStorage : undefined,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: timeoutFetch
  }
});
