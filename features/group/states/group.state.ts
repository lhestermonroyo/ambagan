import { GroupState } from '@/types/groups';
import { create } from 'zustand';

const initialState: GroupState = {
  groups: [],
  details: null
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
