import EXPENSE_STATE from "@/features/expense/states/expense.state";
import GROUP_STATE from "@/features/group/states/group.state";
import NOTIFICATION_STATE from "@/features/notifications/states/notification.state";
import {
  createPreferences,
  getPreferences,
  updatePreferences as updatePreferencesInDB
} from "@/features/user/services/preferences.service";
import { AppearanceMode, UserPreferences, UserState } from "@/types/user";
import * as offlineQueue from "@/utils/offlineQueue";
import { supabase } from "@/utils/supabase";
import { create } from "zustand";

const NOTIF_ALL_ON = {
  notif_settlement_request: true,
  notif_settlement_approved: true,
  notif_settlement_rejected: true,
  notif_settlement_completed: true,
  notif_expense_inclusion: true,
  notif_group_join: true,
  notif_group_leave: true
};

const NOTIF_ALL_OFF = Object.fromEntries(
  Object.keys(NOTIF_ALL_ON).map((k) => [k, false])
) as typeof NOTIF_ALL_ON;

const isAnyNotifEnabled = (prefs: UserPreferences) =>
  Object.keys(NOTIF_ALL_ON).some((k) => prefs[k as keyof UserPreferences]);

const USER_STATE = create<UserState>((set, get) => ({
  loading: true,
  routeIntent: "splash",
  session: null,
  details: null,
  preferences: null,
  appearanceMode: "light",
  notificationsEnabled: true,
  defaultCurrency: "PHP",

  signOut: () => {
    set({
      session: null,
      details: null,
      preferences: null,
      defaultCurrency: "PHP"
    });
    EXPENSE_STATE.getState().reset();
    GROUP_STATE.getState().reset();
    NOTIFICATION_STATE.getState().reset();
    // supabase.auth.signOut();
  },

  setAppearanceMode: async (mode: AppearanceMode) => {
    const { details } = get();
    if (!details?.id) return;
    // Appearance is purely visual, so apply it immediately and let it sync.
    // Offline → queue the preference change (flushed on reconnect) instead of
    // failing the DB write.
    set({ appearanceMode: mode });
    if (await offlineQueue.isOnline()) {
      await updatePreferencesInDB(details.id, { appearance: mode });
    } else {
      await offlineQueue.queueUpdatePreferences(details.id, {
        appearance: mode
      });
    }
  },

  setNotificationsEnabled: async (enabled: boolean) => {
    const { details } = get();
    if (!details?.id) return;
    const notifPrefs = enabled ? NOTIF_ALL_ON : NOTIF_ALL_OFF;
    await updatePreferencesInDB(details.id, notifPrefs);
    set({ notificationsEnabled: enabled });
  },

  setDefaultCurrency: async (userId: string, currency: string) => {
    await updatePreferencesInDB(userId, { default_currency: currency });
    set({ defaultCurrency: currency });
  },

  updatePreferences: async (prefs) => {
    const { details } = get();
    if (!details?.id) return;
    const updated = await updatePreferencesInDB(details.id, prefs);
    set({
      preferences: updated,
      notificationsEnabled: isAnyNotifEnabled(updated),
      ...(prefs.appearance !== undefined && {
        appearanceMode: prefs.appearance
      }),
      ...(prefs.default_currency !== undefined && {
        defaultCurrency: prefs.default_currency
      })
    });
  },

  loadPreferences: async (userId?: string) => {
    if (!userId) return;

    // An appearance change made offline lives in the queue until it syncs —
    // honor it on load so the chosen theme survives a restart while offline.
    const pending = await offlineQueue
      .getPendingPreferences(userId)
      .catch(() => null);

    try {
      let prefs = await getPreferences(userId);

      if (!prefs) {
        prefs = await createPreferences(userId, {
          appearance: "light",
          default_currency: "PHP",
          ...NOTIF_ALL_ON
        });
      }

      set({
        preferences: prefs,
        appearanceMode:
          (pending?.appearance as AppearanceMode) ?? prefs.appearance,
        notificationsEnabled: isAnyNotifEnabled(prefs),
        defaultCurrency: prefs.default_currency
      });
    } catch (error) {
      // Offline / failed load — still apply a pending appearance change so the
      // theme the user picked offline persists across the restart.
      if (pending?.appearance) {
        set({ appearanceMode: pending.appearance as AppearanceMode });
      }
      console.error("Error loading preferences:", error);
    }
  }
}));

export default USER_STATE;
