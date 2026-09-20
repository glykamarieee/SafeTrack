import { supabase } from "../lib/supabase";

export type SafetyTimelineItem = {
  id: string;
  kind: "geofence" | "possible_anomaly" | "watch_disconnected" | "prolonged_inactivity" | "sos";
  title: string;
  details: string | null;
  occurredAt: string;
  latitude: number | null;
  longitude: number | null;
  status?: string;
  anomalyScore?: number | null;
};

function localDayBounds(dateISO?: string) {
  if (!dateISO) return { startAt: undefined, endAt: undefined };
  const [year, month, day] = dateISO.split("-").map(Number);
  if (!year || !month || !day) return { startAt: undefined, endAt: undefined };

  return {
    startAt: new Date(year, month - 1, day, 0, 0, 0, 0).toISOString(),
    endAt: new Date(year, month - 1, day, 23, 59, 59, 999).toISOString(),
  };
}

export async function loadSafetyTimeline(childId: string, dateISO?: string) {
  const { startAt, endAt } = localDayBounds(dateISO);

  const { data, error } = await supabase.functions.invoke("guardian-safety-timeline", {
    body: { childId, startAt, endAt },
  });

  if (error) throw new Error(error.message || "Unable to load SafeTrack history.");
  if (!data?.ok) throw new Error(data?.error || "Unable to load SafeTrack history.");

  const events: SafetyTimelineItem[] = (data.events ?? []).map((row: any) => ({
    id: row.id,
    kind:
      row.event_type === "possible_anomaly"
        ? "possible_anomaly"
        : row.event_type === "watch_disconnected"
          ? "watch_disconnected"
          : row.event_type === "prolonged_inactivity"
            ? "prolonged_inactivity"
            : "geofence",
    title: row.title,
    details: row.details,
    occurredAt: row.occurred_at,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    anomalyScore: row.anomaly_score === null ? null : Number(row.anomaly_score),
  }));

  const sos: SafetyTimelineItem[] = (data.sosAlerts ?? []).map((row: any) => ({
    id: row.id,
    kind: "sos",
    title: "SOS Alert",
    details: `Activation: ${row.activation_method}`,
    occurredAt: row.triggered_at,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    status: row.status,
  }));

  return {
    counts: data.counts as {
      locationRecords: number;
      safetyEvents: number;
      sosAlerts: number;
    },
    items: [...events, ...sos].sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    ),
  };
}

export async function acknowledgeSos(sosAlertId: string) {
  const { data, error } = await supabase.functions.invoke("guardian-ack-sos", {
    body: { sosAlertId },
  });
  if (error) throw new Error(error.message || "Unable to acknowledge SOS.");
  if (!data?.ok) throw new Error(data?.error || "Unable to acknowledge SOS.");
  return data;
}
