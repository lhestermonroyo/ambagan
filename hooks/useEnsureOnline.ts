import useAppToast from "@/hooks/use-app-toast";
import * as offlineQueue from "@/utils/offlineQueue";

/**
 * Guard for actions that require a live server connection and are intentionally
 * NOT supported offline — settlements, profile / account changes, and member
 * management. Returns a function that toasts a generic "you're offline" message
 * and resolves to `false` when offline (so the caller can bail), or `true` when
 * online. Usage:
 *
 *   const ensureOnline = useEnsureOnline();
 *   if (!(await ensureOnline())) return;
 */
export function useEnsureOnline() {
  const toast = useAppToast();

  return async (message?: string): Promise<boolean> => {
    if (await offlineQueue.isOnline()) return true;
    toast({
      title: "You're offline",
      description:
        message ??
        "This action needs an internet connection. Please try again when you're back online.",
      type: "error"
    });
    return false;
  };
}
