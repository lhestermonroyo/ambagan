import EXPENSE_STATE from "@/features/expense/states/expense.state";
import GROUP_STATE from "@/features/group/states/group.state";
import NOTIFICATION_STATE from "@/features/notifications/states/notification.state";
import { logout } from "@/features/user/services/auth.service";
import {
  createPreferences,
  getPreferences,
  updatePreferences as updatePreferencesInDB
} from "@/features/user/services/preferences.service";
import {
  AppearanceMode,
  SettlementView,
  UserPreferences,
  UserState
} from "@/types/user";
import * as offlineQueue from "@/utils/offlineQueue";
import { clearCachedUserSession } from "@/utils/userCache";
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
  oauthName: null,
  preferences: null,
  appearanceMode: "light",
  settlementView: "full",
  notificationsEnabled: true,
  defaultCurrency: "PHP",

  signOut: () => {
    set({
      session: null,
      details: null,
      preferences: null,
      settlementView: "full",
      defaultCurrency: "PHP"
    });
    // Drop the offline profile cache so the next account never hydrates ours.
    clearCachedUserSession();
    EXPENSE_STATE.getState().reset();
    GROUP_STATE.getState().reset();
    NOTIFICATION_STATE.getState().reset();
    // Actually clear the persisted Supabase session (and cached Google
    // account) — otherwise a cold launch's getSession() restores the account
    // we just left. Local state is already cleared above for an instant UI
    // update, so this runs fire-and-forget.
    logout().catch((error) => console.error("Error during sign out:", error));
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

  setSettlementView: async (view: SettlementView) => {
    const { details } = get();
    if (!details?.id) return;
    // Purely visual, so apply it immediately and let it sync. Offline → queue
    // the change (flushed on reconnect) instead of failing the DB write.
    set({ settlementView: view });
    if (await offlineQueue.isOnline()) {
      await updatePreferencesInDB(details.id, { settlement_view: view });
    } else {
      await offlineQueue.queueUpdatePreferences(details.id, {
        settlement_view: view
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
      ...(prefs.settlement_view !== undefined && {
        settlementView: prefs.settlement_view
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
          settlement_view: "full",
          default_currency: "PHP",
          ...NOTIF_ALL_ON
        });
      }

      set({
        preferences: prefs,
        appearanceMode:
          (pending?.appearance as AppearanceMode) ?? prefs.appearance,
        settlementView:
          (pending?.settlement_view as SettlementView) ??
          prefs.settlement_view ??
          "full",
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
