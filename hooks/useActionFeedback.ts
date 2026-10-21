import type { ActionFeedbackKind } from "@/constants/actionFeedback";
import { useActionFeedbackState } from "@/features/user/states/actionFeedback.state";
import states from "@/states";
import { successHaptic } from "@/utils/haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname } from "expo-router";

let nextRequestId = 0;

/** Save success first, then navigate normally. The presenter waits for the form
 * to leave, so closing or swiping the feedback reveals the correct destination. */
export function useActionFeedback() {
  const pathname = usePathname();

  return async (
    kind: ActionFeedbackKind,
    options: { afterNavigation?: boolean; afterPath?: string; once?: boolean } = {}
  ): Promise<boolean> => {
    const user = states.user.getState();
    const userId = user.session?.user.id ?? user.details?.id;
    if (!userId || useActionFeedbackState.getState().request) return false;

    if (options.once) {
      const key = `@action_feedback:${__DEV__ ? "dev" : "prod"}:${userId}:${kind}:v1`;
      try {
        if (await AsyncStorage.getItem(key)) return false;
        await AsyncStorage.setItem(key, "true");
      } catch {
        // A cosmetic confirmation must never turn a saved action into an error.
        return false;
      }
    }

    // The account may have changed while the one-time marker was being read.
    const currentUser = states.user.getState();
    if ((currentUser.session?.user.id ?? currentUser.details?.id) !== userId) {
      return false;
    }

    const enqueued = useActionFeedbackState.getState().enqueue({
      id: String(++nextRequestId),
      kind,
      userId,
      afterNavigationFrom: options.afterNavigation ? pathname : undefined,
      afterNavigationTo: options.afterPath
    });
    if (enqueued) void successHaptic();
    return enqueued;
  };
}
