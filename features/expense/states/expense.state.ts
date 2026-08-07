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
    // Transient hand-off from Scan Receipt → the Add Expense screen,
    // which reads this on mount and clears it.
    scanDraft: ScanDraft | null;
    setScanDraft: (draft: ScanDraft) => void;
    clearScanDraft: () => void;
    reset: () => void;
  }
>((set) => ({
  ...initialState,
  scanDraft: null,
  setScanDraft: (draft) => set({ scanDraft: draft }),
  clearScanDraft: () => set({ scanDraft: null }),
  reset: () => set(initialState)
}));

export default EXPENSE_STATE;
