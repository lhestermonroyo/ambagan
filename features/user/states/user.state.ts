import { UserState } from "@/types/user";
import { supabase } from "@/utils/supabase";
import { create } from "zustand";

const USER_STATE = create<UserState>((set) => ({
  loading: true,
  session: null,
  details: null,

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, details: null });
  }
}));

export default USER_STATE;
