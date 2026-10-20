import type { PaymentPreview } from "@/types/expenses";
import { create } from "zustand";

type SettlementPresentation = {
  id: string;
  userId: string;
  payment: PaymentPreview;
  showGroupLink: boolean;
  onClose: () => void;
  onRefetch: () => void;
};

type SettlementPresentationState = {
  request: SettlementPresentation | null;
  open: (request: Omit<SettlementPresentation, "id">) => string | null;
  finish: (id: string) => void;
};

let nextPresentationId = 0;

// Only the request ID enters navigation params. Keep the cached preview and
// source-list callbacks in memory; neither survives a cold launch or dismissal.
export const useSettlementPresentationState = create<SettlementPresentationState>((set, get) => ({
  request: null,
  open: (request) => {
    if (get().request) return null;
    const id = String(++nextPresentationId);
    set({ request: { ...request, id } });
    return id;
  },
  finish: (id) => {
    const request = get().request;
    if (request?.id !== id) return;
    set({ request: null });
    request.onClose();
  }
}));
