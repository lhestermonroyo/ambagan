import { AuthState } from '@/types/auth';
import { create } from 'zustand';

const initialState: AuthState = {
  authenticated: false,
  loggingOut: false,
  session: null,
  user: null
};

const AUTH_STATE = create<
  AuthState & {
    reset: () => void;
  }
>((set) => ({
  ...initialState,
  reset: () => set(initialState)
}));

export default AUTH_STATE;
