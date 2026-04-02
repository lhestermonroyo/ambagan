import { GroupState } from "@/types/groups";
import { create } from "zustand";

const initialState: GroupState = {
  preview: [],
  list: [],
  details: null,
  refetch: false
};

const GROUP_STATE = create<
  GroupState & {
    reset: () => void;
  }
>((set) => ({
  ...initialState,
  reset: () => set(initialState)
}));

export default GROUP_STATE;
