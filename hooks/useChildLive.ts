import { useCallback } from "react";
import { useFocusEffect } from "expo-router";

import { resumeChildLive, useLiveStore, watchChildLive, type LiveStatus } from "../services/liveLocationService";
import { useLocationStore } from "../store/locationStore";

/**
 * Live position (about every second) while this screen is in front. The
 * location store's `latest` and `liveTrail` follow the fixes, so the map
 * marker moves on its own.
 */
export function useChildLive(childId: string | null | undefined): { status: LiveStatus; resume(): void } {
  useFocusEffect(
    useCallback(() => {
      if (!childId) return;
      return watchChildLive(childId, (fix) => useLocationStore.getState().applyLiveFix(fix));
    }, [childId]),
  );

  const status = useLiveStore((state) => (childId ? state.status[childId] : undefined) ?? "off");
  const resume = useCallback(() => {
    if (childId) resumeChildLive(childId);
  }, [childId]);

  return { status, resume };
}
