import useUserState from "@/features/user/states/user.state";
import type { PaymentPreview } from "@/types/expenses";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { useSettlementPresentationState } from "../states/settlementPresentation.state";

/** Bridge existing list selection to the shared native fullscreen route. */
export default function SettlementActionSheet({ isOpen, onClose, item, onRefetch,
  showGroupLink = true
}: {
  isOpen: boolean;
  onClose: () => void;
  item: PaymentPreview | null;
  onRefetch: () => void;
  showGroupLink?: boolean;
}) {
  const router = useRouter();
  const userId = useUserState((state) => state.details?.id ?? state.session?.user.id);
  const launched = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      launched.current = false;
      return;
    }
    if (!item || !userId || launched.current) return;
    const store = useSettlementPresentationState.getState();
    const requestId = store.open({ payment: item, userId, onClose, onRefetch, showGroupLink });
    if (!requestId) return;
    launched.current = true;
    router.push({ pathname: "/settlement", params: { requestId } });
  }, [isOpen, item, userId, onClose, onRefetch, showGroupLink, router]);

  return null;
}
