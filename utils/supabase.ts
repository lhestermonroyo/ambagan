import { createClient } from '@supabase/supabase-js';
import 'expo-sqlite/localStorage/install';
import { Platform } from 'react-native';

// How long a READ may hang before we abort it and fall back to cached data.
const READ_TIMEOUT_MS = 10000;

/**
 * True when a Postgres error is a unique/PK violation (SQLSTATE 23505). Used by
 * the write services to treat "row already exists" on an offline-sync retry as a
 * repair-in-progress (re-derive children) rather than a hard failure — see
 * saveExpense / saveGroup.
 */
export const isUniqueViolation = (error: unknown): boolean =>
  !!error && typeof error === 'object' && (error as { code?: string }).code === '23505';

const supabaseUrl = process.env.EXPO_PUBLIC_SB_URL as string;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SB_API_KEY as string;

// Dev builds talk to the isolated `dev` schema + `-dev` Edge Functions so local
// development can never touch prod data. Both live in the same Supabase project;
// only the schema/function name differs. Keyed off __DEV__ to stay consistent
// with the RevenueCat sandbox split (see purchase.service.ts) — release builds
// are always prod (public schema, un-suffixed functions).
const DB_SCHEMA = __DEV__ ? 'dev' : 'public';
const FN_SUFFIX = __DEV__ ? '-dev' : '';

/** Resolves an Edge Function name to its per-environment deployment (`…-dev` in dev). */
export const edgeFn = (name: string): string => `${name}${FN_SUFFIX}`;

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
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  db: {
    schema: DB_SCHEMA
  },
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
