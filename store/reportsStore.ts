import { create } from "zustand";
import {
  fetchAllReports,
  fetchReportsForGuardian,
} from "../services/reportsService";
import { readCache, writeCache } from "../lib/offlineCache";
import type { ActivityReport } from "../types/safetrack";

interface ReportsState {
  reports: ActivityReport[];
  isLoading: boolean;
  error: string | null;
  isOffline: boolean;
  cachedAt: string | null;

  loadForGuardian: (guardianId: string) => Promise<void>;
  loadAll: () => Promise<void>;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Could not load reports.";
}

export const useReportsStore = create<ReportsState>((set) => ({
  reports: [],
  isLoading: false,
  error: null,
  isOffline: false,
  cachedAt: null,

  loadForGuardian: async (guardianId: string) => {
    const cacheKey = `reports:guardian:${guardianId}`;

    set({
      isLoading: true,
      error: null,
    });

    try {
      const reports = await fetchReportsForGuardian(guardianId);

      set({
        reports,
        isOffline: false,
        cachedAt: new Date().toISOString(),
      });

      await writeCache<ActivityReport[]>(cacheKey, reports);
    } catch (error) {
      const cached = await readCache<ActivityReport[]>(cacheKey);

      if (cached) {
        set({
          reports: cached.data,
          isOffline: true,
          cachedAt: cached.cachedAt,
        });
      } else {
        set({
          error: getErrorMessage(error),
        });
      }
    } finally {
      set({
        isLoading: false,
      });
    }
  },

  loadAll: async () => {
    const cacheKey = "reports:all";

    set({
      isLoading: true,
      error: null,
    });

    try {
      const reports = await fetchAllReports();

      set({
        reports,
        isOffline: false,
        cachedAt: new Date().toISOString(),
      });

      await writeCache<ActivityReport[]>(cacheKey, reports);
    } catch (error) {
      const cached = await readCache<ActivityReport[]>(cacheKey);

      if (cached) {
        set({
          reports: cached.data,
          isOffline: true,
          cachedAt: cached.cachedAt,
        });
      } else {
        set({
          error: getErrorMessage(error),
        });
      }
    } finally {
      set({
        isLoading: false,
      });
    }
  },
}));