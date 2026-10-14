import { create } from "zustand";

import { fetchAnomaliesForChild } from "../services/anomalyService";
import type { SafetyTimelineItem } from "../services/safetyEventsService";

interface AnomalyState {
  anomalies: SafetyTimelineItem[];
  latestAnomaly: SafetyTimelineItem | null;
  isLoading: boolean;
  error: string | null;
  loadForChild: (childId: string) => Promise<void>;
  clear: () => void;
}

// supabase-js errors are plain objects, not Error instances.
function messageOf(error: unknown, fallback: string) {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" && message ? message : fallback;
}

/** AI anomaly notices (advisory) for the selected child. */
export const useAnomalyStore = create<AnomalyState>((set) => ({
  anomalies: [],
  latestAnomaly: null,
  isLoading: false,
  error: null,

  loadForChild: async (childId) => {
    if (!childId) {
      set({ anomalies: [], latestAnomaly: null });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const anomalies = await fetchAnomaliesForChild(childId);
      set({ anomalies, latestAnomaly: anomalies[0] ?? null, isLoading: false });
    } catch (error) {
      set({ error: messageOf(error, "Unable to load AI safety data."), isLoading: false });
    }
  },

  clear: () => set({ anomalies: [], latestAnomaly: null, error: null }),
}));
