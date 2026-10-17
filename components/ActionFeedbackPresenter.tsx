import { useActionFeedbackState } from "@/features/user/states/actionFeedback.state";
import useUserState from "@/features/user/states/user.state";
import { usePathname, useRootNavigationState, useRouter } from "expo-router";
import { useEffect } from "react";
import { Keyboard } from "react-native";

export default function ActionFeedbackPresenter() {
  const request = useActionFeedbackState((state) => state.request);
  const pathname = usePathname();
  const router = useRouter();
  const navigation = useRootNavigationState();
  const focusedRoute = navigation?.routes[navigation.index ?? 0]?.name;
  const userId = useUserState((state) => state.session?.user.id ?? state.details?.id);

  useEffect(() => {
    if (!request) return;
    const store = useActionFeedbackState.getState();
    if (request.userId !== userId) {
      store.clear(request.id);
      return;
    }
    if (request.presented || request.afterNavigationFrom === pathname) return;
    if (request.afterNavigationTo && request.afterNavigationTo !== pathname) return;
    if (!focusedRoute || ["feature-tour", "update-available", "subscription-success"].includes(focusedRoute)) return;
    if (!store.present(request.id)) return;

    Keyboard.dismiss();
    router.push({
      pathname: "/action-success",
      params: { kind: request.kind, feedbackId: request.id }
    });
  }, [request, pathname, router, userId, focusedRoute]);

  return null;
}
