import { UserState } from "@/types/user";
import { create } from "zustand";

const initialState: UserState = {
  loggingOut: false,
  session: null,
  details: null
};

const USER_STATE = create<
  UserState & {
    reset: () => void;
  }
>((set) => ({
  ...initialState,
  reset: () => set(initialState)
}));

export default USER_STATE;
