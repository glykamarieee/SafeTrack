import { useEffect } from "react";

import { subscribeToGuardianSos } from "../services/sosService";
import { useSosStore } from "../store/sosStore";

/**
 * Keeps SOS alerts live while a guardian is in the app, so a new SOS, a
 * re-alert or an acknowledgement shows without refreshing. Push
 * notifications cover the app being closed.
 */
export function useGuardianSosRealtime(guardianId: string | null | undefined) {
  useEffect(() => {
    if (!guardianId) return;

    return subscribeToGuardianSos(guardianId, (row) => useSosStore.getState().applyLiveRow(row));
  }, [guardianId]);
}
