import KeyboardAvoidingSheet from "@/components/KeyboardAvoidingSheet";
import SettlementScreenContent from "@/features/expense/components/SettlementScreenContent";
import { useSettlementPresentationState } from "@/features/expense/states/settlementPresentation.state";
import useUserState from "@/features/user/states/user.state";
import { useBanner } from "@/hooks/useBanner";
import { useLocalSearchParams, useRouter } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/** Same native presentation as the tour, with a fullscreen modal and one shell
 * throughout the details → record-payment transition. */
export default function SettlementScreen() {
  const router = useRouter();
  const { requestId } = useLocalSearchParams<{ requestId?: string }>();
  const request = useSettlementPresentationState((state) => state.request);
  const userId = useUserState((state) => state.details?.id ?? state.session?.user.id);
  const { sheetTopInset } = useBanner();
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const locked = useRef(false);
  const valid = !!request && request.id === requestId && request.userId === userId;

  // Covers Android back and navigation removal while a payment is being saved.
  // iOS fullscreen modals have no card-style swipe-down dismissal.
  usePreventRemove(busy && valid, () => {});
  const onBusyChange = useCallback((value: boolean) => {
    locked.current = value;
    setBusy(value);
  }, []);
  const close = useCallback(() => {
    if (!locked.current) setClosing(true);
  }, []);

  useEffect(() => {
    if ((!closing && valid) || busy) return;
    Keyboard.dismiss();
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [closing, valid, busy, router]);

  useEffect(() => () => {
    if (requestId) useSettlementPresentationState.getState().finish(requestId);
  }, [requestId]);

  return (
    <SafeAreaView
      className="flex-1 bg-background-0"
      edges={{ top: "maximum", bottom: "additive" }}
      // Match the previous fullscreen sheet's top padding without adding the
      // status-bar inset twice. Larger device safe areas still take precedence.
      style={{ paddingTop: sheetTopInset - 8 }}
    >
      <KeyboardAvoidingSheet>
        {valid && (
          <SettlementScreenContent payment={request.payment} showGroupLink={request.showGroupLink}
            onClose={close} onRefetch={request.onRefetch} onBusyChange={onBusyChange} />
        )}
      </KeyboardAvoidingSheet>
    </SafeAreaView>
  );
}
