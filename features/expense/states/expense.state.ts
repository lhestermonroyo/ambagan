import { ExpenseState, ScanDraft } from "@/types/expenses";
import { create } from "zustand";

const initialState: ExpenseState = {
  activityList: [],
  details: null,
  payerList: [],
  memberSplitList: [],
  paymentSplitList: [],
};

const EXPENSE_STATE = create<
  ExpenseState & {
    // Transient hand-off from Scan Receipt (Beta) → the chosen expense flow.
    scanDraft: ScanDraft | null;
    setScanDraft: (draft: ScanDraft) => void;
    clearScanDraft: () => void;
    // Paired with scanDraft: when the post-scan picker chooses Quick Add, this
    // signals the origin screen (home / group) to open its Quick Add sheet
    // seeded from the draft. Custom needs no flag — its route reads scanDraft on
    // mount directly.
    pendingQuickAdd: boolean;
    setPendingQuickAdd: (value: boolean) => void;
    reset: () => void;
  }
>((set) => ({
  ...initialState,
  scanDraft: null,
  setScanDraft: (draft) => set({ scanDraft: draft }),
  clearScanDraft: () => set({ scanDraft: null }),
  pendingQuickAdd: false,
  setPendingQuickAdd: (value) => set({ pendingQuickAdd: value }),
  reset: () => set(initialState)
}));

export default EXPENSE_STATE;
