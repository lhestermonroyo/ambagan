import { NotificationState } from "@/types/notifications";
import { create } from "zustand";

const initialState: NotificationState = {
  list: [],
  unreadCount: 0
};

const NOTIFICATION_STATE = create<
  NotificationState & {
    reset: () => void;
  }
>((set) => ({
  ...initialState,
  reset: () => set(initialState)
}));

export default NOTIFICATION_STATE;
