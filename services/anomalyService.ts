import { supabase } from "../lib/supabase";

import type { SafetyTimelineItem } from "./safetyEventsService";

/**
 * AI anomaly notices for a child, newest first. The server writes them to
 * `geofence_events` with event_type `possible_anomaly` (there is no
 * `safety_events` table); `details` holds the plain-language reasons.
 * They are advisory, and guardians cannot change these rows (no UPDATE policy),
 * so there is nothing to acknowledge here.
 */
export async function fetchAnomaliesForChild(childId: string, limit = 20): Promise<SafetyTimelineItem[]> {
  const { data, error } = await supabase
    .from("geofence_events")
    .select("id, title, details, latitude, longitude, anomaly_score, occurred_at")
    .eq("child_id", childId)
    .eq("event_type", "possible_anomaly")
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    kind: "possible_anomaly",
    title: row.title ?? "Possible unusual activity",
    details: row.details ?? null,
    occurredAt: String(row.occurred_at),
    latitude: row.latitude === null || row.latitude === undefined ? null : Number(row.latitude),
    longitude: row.longitude === null || row.longitude === undefined ? null : Number(row.longitude),
    anomalyScore: row.anomaly_score === null || row.anomaly_score === undefined ? null : Number(row.anomaly_score),
  }));
}
