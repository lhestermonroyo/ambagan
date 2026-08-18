import { getUpdateGate } from "@/features/user/services/app-version.service";
import states from "@/states";
import { isUpdateSnoozed } from "@/utils/updatePrompt";
import { useRootNavigationState, useRouter } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useNetwork } from "./useNetwork";

/**
 * How stale a check may get before a foreground return re-runs it. A release
 * lands once every few weeks, so anything shorter is a query per app switch for
 * an answer that almost never changes — but it still has to be short enough
 * that an incident (a raised `min_supported_version`) reaches a device that
 * hasn't cold-launched in days.
 */
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Root routes that already own the whole screen. Pushing the update modal on
 * top of one of these would stack two modals; the gate waits instead, and the
 * effect below re-fires when focus comes back.
 */
const BLOCKING_ROUTES = ["feature-tour", "update-available"];

/**
 * Decides whether this build is out of date and, if so, presents
 * app/update-available.tsx.
 *
 * Split into two effects on purpose. WHETHER to prompt is a network question
 * answered on launch and on foreground return; WHEN to prompt is a navigation
 * question that can only be answered once nothing else is presenting. Resolving
 * both in one place is what produced double modals on a first run.
 *
 * Mounted headlessly from components/AppUpdateGate.tsx so the root layout
 * doesn't re-render on every navigation just to read the focused route.
 */
export function useAppUpdate() {
  const router = useRouter();
  const { isOnline } = useNetwork();
  const gate = states.appUpdate((s) => s.gate);
  const setGate = states.appUpdate((s) => s.setGate);

  const rootState = useRootNavigationState();
  const focusedRoute =
    rootState?.routes?.[rootState.index ?? 0]?.name ?? undefined;

  const lastCheckedAt = useRef(0);
  const promptedFor = useRef<string | null>(null);

  const check = useCallback(async () => {
    lastCheckedAt.current = Date.now();

    try {
      const result = await getUpdateGate();
      if (!result || result.status === "current") return;

      // A required update ignores the snooze entirely — that's the whole point
      // of the floor being a separate threshold from `latest_version`.
      if (result.status === "optional") {
        if (await isUpdateSnoozed(result.latestVersion)) return;
      }

      setGate(result);
    } catch {
      // Fail open. An unreachable check must look exactly like "you're current"
      // — never like a reason to interrupt someone.
    }
  }, [setGate]);

  // Launch check, and again whenever connectivity returns (a cold launch in
  // airplane mode would otherwise never check until the next foreground).
  useEffect(() => {
    if (!isOnline) return;
    if (Date.now() - lastCheckedAt.current < RECHECK_INTERVAL_MS) return;
    check();
  }, [isOnline, check]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      if (Date.now() - lastCheckedAt.current < RECHECK_INTERVAL_MS) return;
      check();
    });

    return () => sub.remove();
  }, [check]);

  // Presentation. Waits for a frame where nothing else is on top, so the prompt
  // lands after the feature tour rather than under it.
  useEffect(() => {
    if (!gate || !focusedRoute) return;
    if (BLOCKING_ROUTES.includes(focusedRoute)) return;

    // A REQUIRED prompt re-arms unconditionally. It can't normally be dismissed
    // (no back, no swipe, no "Not now"), but if it ever were — a stray
    // programmatic navigation, a dev reload — the kill switch has to come
    // straight back rather than stay defeated for the session. The
    // focusedRoute check above is what stops that from looping.
    if (gate.status !== "required") {
      // Keyed by status as well as version so a build that was merely behind
      // and got snoozed can still prompt again once that same version becomes
      // the enforced floor.
      const key = `${gate.status}:${gate.latestVersion}`;
      if (promptedFor.current === key) return;
      promptedFor.current = key;
    }

    router.push({
      pathname: "/update-available",
      params: gate.status === "required" ? { forced: "1" } : {}
    });
  }, [gate, focusedRoute, router]);
}
