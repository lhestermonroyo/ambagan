import { BookState } from "@/types/books";
import { create } from "zustand";

const initialState: BookState = {
  list: [],
  initialized: false,
  details: null,
  expenseList: []
};

const BOOK_STATE = create<
  BookState & {
    reset: () => void;
  }
>((set) => ({
  ...initialState,
  reset: () => set(initialState)
}));

export default BOOK_STATE;
