import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";

import { fetchSmartwatchForChild, type SmartwatchStatus } from "../services/smartwatchService";
import { useLocationStore } from "../store/locationStore";

/** The watch reports battery with every heartbeat and location; read it this often. */
const REFRESH_MS = 30_000;

/**
 * The child's watch status (battery, network, last contact), kept current
 * while the screen is in front: read on focus, every REFRESH_MS, and when a
 * new saved location arrives. Null for a phone-only child.
 */
export function useWatchStatus(childId: string | null | undefined): {
  watch: SmartwatchStatus | null;
  refresh(): Promise<void>;
} {
  const [watch, setWatch] = useState<SmartwatchStatus | null>(null);

  const refresh = useCallback(async () => {
    if (!childId) {
      setWatch(null);
      return;
    }
    try {
      setWatch(await fetchSmartwatchForChild(childId));
    } catch {
      // Keep the last known value while offline.
    }
  }, [childId]);

  useEffect(() => {
    setWatch(null);
  }, [childId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      const timer = setInterval(() => void refresh(), REFRESH_MS);
      return () => clearInterval(timer);
    }, [refresh]),
  );

  // A new saved record (not a live fix) also brings a new battery reading.
  const savedAt = useLocationStore((state) =>
    state.history[0]?.childId === childId ? state.history[0]?.recordedAt : undefined,
  );
  useEffect(() => {
    if (savedAt) void refresh();
  }, [savedAt, refresh]);

  return { watch, refresh };
}
