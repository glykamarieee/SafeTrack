import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// Must match geofence_events_event_type_check.
const ANOMALY_EVENT_TYPE = "possible_anomaly";

const LOCATION_COLUMNS = "latitude, longitude, accuracy_meters, source, recorded_at";

export async function reviewAnomaly(args: {
  supabase: SupabaseClient;
  childId: string;
  locationLogId: string;
}) {
  const aiEnabled = (Deno.env.get("AI_ENABLED") ?? "false").toLowerCase() === "true";
  const aiUrl = Deno.env.get("AI_SERVICE_URL");
  const aiKey = Deno.env.get("AI_SERVICE_KEY");

  if (!aiEnabled || !aiUrl) return;

  if (!aiKey) {
    console.error("AI_SERVICE_KEY is not set; skipping AI review");
    return;
  }

  const { supabase, childId, locationLogId } = args;

  // Score the stored row, and only if it belongs to this child.
  const { data: current, error: currentError } = await supabase
    .from("location_logs")
    .select(`child_id, ${LOCATION_COLUMNS}`)
    .eq("id", locationLogId)
    .maybeSingle();

  if (currentError) {
    console.error("AI current location query failed", currentError);
    return;
  }

  if (!current || current.child_id !== childId) return;

  const latitude = Number(current.latitude);
  const longitude = Number(current.longitude);
  const recordedAt = current.recorded_at as string;

  const { data: recentNotice } = await supabase
    .from("geofence_events")
    .select("id, occurred_at")
    .eq("child_id", childId)
    .eq("event_type", ANOMALY_EVENT_TYPE)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentNotice?.occurred_at) {
    const elapsed =
      Date.now() - new Date(recentNotice.occurred_at).getTime();

    if (elapsed < 15 * 60 * 1000) return;
  }

  const { data: history, error } = await supabase
    .from("location_logs")
    .select(LOCATION_COLUMNS)
    .eq("child_id", childId)
    // Earlier points only: the current one is sent separately.
    .lt("recorded_at", recordedAt)
    .order("recorded_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("AI history query failed", error);
    return;
  }

  if (!history || history.length < 100) return;

  const sorted = [...history].sort(
    (a, b) =>
      new Date(a.recorded_at).getTime() -
      new Date(b.recorded_at).getTime(),
  );

  const baselineDays =
    (new Date(sorted.at(-1)!.recorded_at).getTime() -
      new Date(sorted[0].recorded_at).getTime()) /
    86_400_000;

  if (baselineDays < 14) return;

  const response = await fetch(`${aiUrl.replace(/\/$/, "")}/score`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-SafeTrack-AI-Key": aiKey,
    },
    body: JSON.stringify({
      history: sorted,
      current: {
        latitude,
        longitude,
        accuracy_meters: current.accuracy_meters,
        source: current.source,
        recorded_at: recordedAt,
      },
    }),
  });

  if (!response.ok) {
    console.error("AI service failed", await response.text());
    return;
  }

  const result = await response.json();

  if (!result.ready || !result.is_anomaly) return;

  const details =
    Array.isArray(result.reasons) && result.reasons.length > 0
      ? `Possible unusual movement: ${result.reasons.join(", ")}. Advisory only.`
      : "Possible unusual movement detected from available location history. Advisory only.";

  const score = Number(result.anomaly_score ?? 0);

  const { error: insertError } = await supabase
    .from("geofence_events")
    .insert({
      child_id: childId,
      geofence_id: null,
      location_log_id: locationLogId,
      event_type: ANOMALY_EVENT_TYPE,
      title: "Unusual movement notice",
      details,
      anomaly_score: score,
      latitude,
      longitude,
      occurred_at: recordedAt,
    });

  // The Guardian is notified by the geofence_events_notify_guardian trigger.
  if (insertError) {
    console.error("anomaly event insert failed", insertError);
  }
}
