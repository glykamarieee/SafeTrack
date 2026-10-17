import { useEffect } from "react";

import { subscribeToChildSafetyEvents, subscribeToGuardianSos } from "../services/sosService";
import { notifyAlert } from "../services/alertNotifier";
import { DEFAULT_NOTIFICATION_PREFERENCES, fetchNotificationPreferences } from "../services/accountService";
import { useAuthStore } from "../store/authStore";
import { useSosStore } from "../store/sosStore";

function childName(childId: unknown) {
  const child = useAuthStore.getState().linkedChildren.find((item) => item.id === childId);
  return child?.fullName?.split(" ")[0] || "Your child";
}

/** Notification text for a new geofence_events row, by event_type. */
function describeEvent(row: Record<string, unknown>) {
  const name = childName(row.child_id);
  const title = typeof row.title === "string" && row.title.trim() ? row.title.trim() : "";
  const details = typeof row.details === "string" && row.details.trim() ? row.details.trim() : "";

  switch (row.event_type) {
    case "entry":
      return { title: `${name} arrived`, body: title || details || `${name} entered a safe zone.` };
    case "exit":
      return { title: `${name} left a safe zone`, body: title || details || `${name} left a safe zone.` };
    case "possible_anomaly":
      return { title: "Unusual movement", body: details || title || `Check ${name}'s latest location.` };
    case "watch_disconnected":
      return { title: "Watch disconnected", body: details || `${name}'s watch stopped sending updates.` };
    case "prolonged_inactivity":
      return { title: "No movement for a while", body: details || `${name} hasn't moved for some time.` };
    default:
      return null;
  }
}

/** The guardian's notification switches (the server push honours the same ones). */
async function eventAllowed(guardianId: string, type: unknown) {
  const prefs = await fetchNotificationPreferences(guardianId).catch(() => DEFAULT_NOTIFICATION_PREFERENCES);
  if (type === "entry" || type === "exit") return prefs.safeZone;
  if (type === "possible_anomaly") return prefs.anomaly;
  if (type === "watch_disconnected" || type === "prolonged_inactivity") return prefs.device;
  return true;
}

/**
 * Keeps SOS alerts live while a guardian is in the app, so a new SOS, a
 * re-alert or an acknowledgement shows without refreshing, and shows new SOS
 * and safety events as phone notifications with sound, also while the
 * guardian is in another app. Server push covers the app being closed.
 */
export function useGuardianSosRealtime(guardianId: string | null | undefined) {
  const childIds = useAuthStore((state) => state.linkedChildren.map((child) => child.id).join(","));

  useEffect(() => {
    if (!guardianId) return;

    return subscribeToGuardianSos(guardianId, (row, change) => {
      useSosStore.getState().applyLiveRow(row);

      if (row.status !== "active" || row.is_test === true) return;
      const name = childName(row.child_id);
      const id = String(row.id ?? "");

      if (change.event === "INSERT") {
        void notifyAlert({
          key: `sos:${id}`,
          type: "sos",
          title: `🚨 SOS from ${name}`,
          body: `${name} needs help. Open SafeTrack to see where.`,
          data: { sos_alert_id: id, child_id: row.child_id },
        });
        return;
      }

      const count = Number(row.realert_count ?? 0);
      const before = Number(change.old.realert_count ?? count - 1);
      if (change.event === "UPDATE" && count > 0 && count !== before) {
        void notifyAlert({
          key: `sos:${id}:realert:${count}`,
          type: "sos_realert",
          title: `🚨 SOS still active – ${name}`,
          body: `${name}'s SOS hasn't been acknowledged yet.`,
          data: { sos_alert_id: id, child_id: row.child_id },
        });
      }
    });
  }, [guardianId]);

  useEffect(() => {
    if (!guardianId || !childIds) return;

    return subscribeToChildSafetyEvents(childIds.split(","), async (row) => {
      const text = describeEvent(row);
      if (!text || !(await eventAllowed(guardianId, row.event_type))) return;
      void notifyAlert({
        key: `event:${String(row.id ?? Math.random())}`,
        type: String(row.event_type),
        ...text,
        data: { child_id: row.child_id },
      });
    });
  }, [guardianId, childIds]);
}
