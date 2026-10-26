import type { ActionFeedbackKind } from "@/constants/actionFeedback";
import { create } from "zustand";

type FeedbackRequest = {
  id: string;
  kind: ActionFeedbackKind;
  userId: string;
  /** Wait for the form to leave before presenting over its destination. */
  afterNavigationFrom?: string;
  afterNavigationTo?: string;
  presented: boolean;
};

type ActionFeedbackState = {
  request: FeedbackRequest | null;
  enqueue: (request: Omit<FeedbackRequest, "presented">) => boolean;
  present: (id: string) => boolean;
  clear: (id: string) => void;
};

// Session-local: a completed action must never reappear after a cold launch.
export const useActionFeedbackState = create<ActionFeedbackState>((set, get) => ({
  request: null,
  enqueue: (request) => {
    if (get().request) return false;
    set({ request: { ...request, presented: false } });
    return true;
  },
  present: (id) => {
    const request = get().request;
    if (!request || request.id !== id || request.presented) return false;
    set({ request: { ...request, presented: true } });
    return true;
  },
  clear: (id) => {
    if (get().request?.id === id) set({ request: null });
  }
}));
