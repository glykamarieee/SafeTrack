import { create } from "zustand";
import {
  acknowledgeSosAlert,
  fetchAllSosAlerts,
  fetchSosAlertsForChild,
  mapSosRow,
} from "../services/sosService";

// supabase-js errors are plain objects, not Error instances.
function messageOf(error: unknown, fallback: string) {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" && message ? message : fallback;
}
import { readCache, writeCache } from "../lib/offlineCache";
import type { SosAlert } from "../types/safetrack";

interface SosState {
  alerts: SosAlert[];
  isLoading: boolean;
  error: string | null;
  isOffline: boolean;
  cachedAt: string | null;

  loadForChild: (childId: string, childName?: string) => Promise<void>;
  loadAll: () => Promise<void>;
  acknowledge: (alertId: string) => Promise<void>;
  /** Apply a live sos_alerts row (insert or update) to the loaded child's list. */
  applyLiveRow: (row: Record<string, unknown>) => void;
}

export const useSosStore = create<SosState>((set, get) => ({
  alerts: [],
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

  applyLiveRow: (row) => {
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
