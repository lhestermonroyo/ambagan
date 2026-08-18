import { UpdateGate } from "@/types/appVersion";
import { create } from "zustand";

/**
 * The pending update prompt, if any.
 *
 * A store rather than route params because the payload includes an array of
 * release notes, and because the decision ("should we prompt?") and the
 * presentation ("what does the sheet say?") happen in two different places:
 * {@link useAppUpdate} resolves it against the server and the snooze, and
 * app/update-available.tsx renders it.
 *
 * Only ever holds a gate that has already been judged worth showing — a
 * `current` build, or an `optional` one that's still snoozed, leaves this null.
 */
type AppUpdateState = {
  gate: UpdateGate | null;
  setGate: (gate: UpdateGate | null) => void;
};

const APP_UPDATE_STATE = create<AppUpdateState>((set) => ({
  gate: null,
  setGate: (gate) => set({ gate })
}));

export default APP_UPDATE_STATE;
