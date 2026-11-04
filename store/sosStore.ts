import { create } from "zustand";
import {
  acknowledgeSosAlert,
  fetchActiveSosAlerts,
  fetchAllSosAlerts,
  fetchSosAlertsForChild,
  mapSosRow,
} from "../services/sosService";
import { useAuthStore } from "./authStore";

// supabase-js errors are plain objects, not Error instances.
function messageOf(error: unknown, fallback: string) {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" && message ? message : fallback;
}
import { readCache, writeCache } from "../lib/offlineCache";
import type { SosAlert } from "../types/safetrack";

function nameOf(childId: unknown) {
  return useAuthStore.getState().linkedChildren.find((child) => child.id === childId)?.fullName ?? "Child";
}

interface SosState {
  alerts: SosAlert[];
  /** Active SOS alerts of every child of the guardian (Home banner, switcher dots). */
  activeAll: SosAlert[];
  isLoading: boolean;
  error: string | null;
  isOffline: boolean;
  cachedAt: string | null;

  loadForChild: (childId: string, childName?: string) => Promise<void>;
  loadAll: () => Promise<void>;
  loadActiveAll: () => Promise<void>;
  acknowledge: (alertId: string) => Promise<void>;
  /** Apply a live sos_alerts row (insert or update) to the loaded child's list. */
  applyLiveRow: (row: Record<string, unknown>) => void;
}

export const useSosStore = create<SosState>((set, get) => ({
  alerts: [],
  activeAll: [],
  isLoading: false,
  error: null,
  isOffline: false,
  cachedAt: null,

  loadForChild: async (childId, childName = "Child") => {
    set({ isLoading: true, error: null });
    const cacheKey = `sos:child:${childId}`;

    try {
      const alerts = await fetchSosAlertsForChild(childId, childName);
      const cachedAt = new Date().toISOString();
      set({ alerts, isOffline: false, cachedAt });
      void writeCache<SosAlert[]>(cacheKey, alerts);
    } catch (error) {
      const cached = await readCache<SosAlert[]>(cacheKey);
      if (cached) {
        set({ alerts: cached.data, isOffline: true, cachedAt: cached.cachedAt });
      } else {
        set({
          error:
            messageOf(error, "Could not load SOS alerts."),
        });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  loadAll: async () => {
    set({ isLoading: true, error: null });
    try {
      const alerts = await fetchAllSosAlerts();
      set({ alerts, isOffline: false, cachedAt: new Date().toISOString() });
    } catch (error) {
      set({
        error:
          messageOf(error, "Could not load SOS alerts."),
      });
    } finally {
      set({ isLoading: false });
    }
  },

  loadActiveAll: async () => {
    try {
      const rows = await fetchActiveSosAlerts();
      set({ activeAll: rows.map((alert) => ({ ...alert, childName: nameOf(alert.childId) })) });
    } catch {
      // The banner keeps the last known list; the per-child list reports errors.
    }
  },

  applyLiveRow: (row) => {
    const live = mapSosRow(row, nameOf(row.child_id));
    const others = get().activeAll.filter((alert) => alert.id !== live.id);
    set({ activeAll: live.status === "active" ? [live, ...others] : others });

    const alerts = get().alerts;
    const id = String(row.id ?? "");
    const existing = alerts.find((alert) => alert.id === id);
    // The list holds one child's alerts; ignore other children's rows.
    const childId = alerts[0]?.childId;
    if (!existing && childId && row.child_id !== childId) return;

    const alert = mapSosRow(row, existing?.childName ?? alerts[0]?.childName ?? "Child");
    set({
      alerts: existing
        ? alerts.map((item) => (item.id === id ? alert : item))
        : [alert, ...alerts],
    });
  },

  acknowledge: async (alertId) => {
    const previous = get().alerts;
    const acknowledgedAt = new Date().toISOString();

    set({
      alerts: previous.map((alert) =>
        alert.id === alertId
          ? { ...alert, status: "acknowledged", acknowledgedAt }
          : alert
      ),
      activeAll: get().activeAll.filter((alert) => alert.id !== alertId),
      error: null,
    });

    try {
      await acknowledgeSosAlert(alertId);
    } catch (error) {
      set({
        alerts: previous,
        error:
          messageOf(error, "Could not acknowledge the SOS alert."),
      });
      throw error;
    }
  },

}));
