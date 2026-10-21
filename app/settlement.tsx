import KeyboardAvoidingSheet from "@/components/KeyboardAvoidingSheet";
import SettlementScreenContent from "@/features/expense/components/SettlementScreenContent";
import { useSettlementPresentationState } from "@/features/expense/states/settlementPresentation.state";
import useUserState from "@/features/user/states/user.state";
import { useBanner } from "@/hooks/useBanner";
import { OverlayProvider } from "@gluestack-ui/core/overlay/creator";
import { useLocalSearchParams, useRouter } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Same native presentation as the tour, with a fullscreen modal and one shell
 * throughout the details → record-payment transition. */
export default function SettlementScreen() {
  const router = useRouter();
  const { requestId } = useLocalSearchParams<{ requestId?: string }>();
  const request = useSettlementPresentationState((state) => state.request);
  const userId = useUserState((state) => state.details?.id ?? state.session?.user.id);
  const { sheetTopInset } = useBanner();
  const insets = useSafeAreaInsets();
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
    <View
      className="flex-1 bg-background-0"
      // Use the available context insets on the first render. A native
      // SafeAreaView inside the presented modal can apply them after mounting,
      // changing the footer position between the first and later openings.
      style={{
        paddingTop: Math.max(insets.top, sheetTopInset - 8),
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right
      }}
    >
      {/* Keep confirmation and image-picker portals in this native modal.
          The app-level host belongs to the screen underneath it. */}
      <OverlayProvider>
        <KeyboardAvoidingSheet>
          {valid && (
            <SettlementScreenContent payment={request.payment} showGroupLink={request.showGroupLink}
              onClose={close} onRefetch={request.onRefetch} onBusyChange={onBusyChange} />
          )}
        </KeyboardAvoidingSheet>
      </OverlayProvider>
    </View>
  );
}
