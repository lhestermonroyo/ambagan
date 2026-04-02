import { ExpenseState } from "@/types/expenses";
import { create } from "zustand";

const initialState: ExpenseState = {
  preview: [],
  list: [],
  details: null
};

const EXPENSE_STATE = create<
  ExpenseState & {
    reset: () => void;
  }
>((set) => ({
  ...initialState,
  reset: () => set(initialState)
}));

export default EXPENSE_STATE;
