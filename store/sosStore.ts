import { create } from "zustand";
import {
  acknowledgeSosAlert,
  fetchAllSosAlerts,
  fetchSosAlertsForChild,
  resolveSosAlert,
  triggerTestSosAlert,
} from "../services/sosService";
import { readCache, writeCache } from "../lib/offlineCache";
import type { SosAlert } from "../types/safetrack";

interface SosState {
  alerts: SosAlert[];
  isLoading: boolean;
  error: string | null;
  isOffline: boolean;
  cachedAt: string | null;
  isSendingTest: boolean;
  lastTestAlert: SosAlert | null;

  loadForChild: (childId: string, childName?: string) => Promise<void>;
  loadAll: () => Promise<void>;
  sendTestAlert: (childId: string, childName: string, guardianId?: string) => Promise<void>;
  acknowledge: (alertId: string) => Promise<void>;
  resolve: (alertId: string) => Promise<void>;
}

export const useSosStore = create<SosState>((set, get) => ({
  alerts: [],
  isLoading: false,
  error: null,
  isOffline: false,
  cachedAt: null,
  isSendingTest: false,
  lastTestAlert: null,

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
            error instanceof Error ? error.message : "Could not load SOS alerts.",
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
          error instanceof Error ? error.message : "Could not load SOS alerts.",
      });
    } finally {
      set({ isLoading: false });
    }
  },

  sendTestAlert: async (childId, childName) => {
    set({ isSendingTest: true, error: null });
    try {
      const alert = await triggerTestSosAlert(childId, childName);
      set({ lastTestAlert: alert, alerts: [alert, ...get().alerts] });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Could not send test SOS alert.",
      });
      throw error;
    } finally {
      set({ isSendingTest: false });
    }
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
          error instanceof Error
            ? error.message
            : "Could not acknowledge the SOS alert.",
      });
      throw error;
    }
  },

  resolve: async (alertId) => {
    const previous = get().alerts;

    set({
      alerts: previous.map((alert) =>
        alert.id === alertId ? { ...alert, status: "resolved" } : alert
      ),
      error: null,
    });

    try {
      await resolveSosAlert(alertId);
    } catch (error) {
      set({
        alerts: previous,
        error:
          error instanceof Error ? error.message : "Could not resolve the SOS alert.",
      });
      throw error;
    }
  },
}));
