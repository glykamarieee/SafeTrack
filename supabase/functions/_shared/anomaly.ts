import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { sendGuardianPush } from "./push.ts";

export async function reviewAnomaly(args: {
  supabase: SupabaseClient;
  childId: string;
  guardianId: string;
  locationLogId: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
}) {
  const aiEnabled = (Deno.env.get("AI_ENABLED") ?? "false").toLowerCase() === "true";
  const aiUrl = Deno.env.get("AI_SERVICE_URL");

  if (!aiEnabled || !aiUrl) return;

  const {
    supabase,
    childId,
    guardianId,
    locationLogId,
    latitude,
    longitude,
    recordedAt,
  } = args;

  const { data: recentNotice } = await supabase
    .from("geofence_events")
    .select("id, occurred_at")
    .eq("child_id", childId)
    .eq("event_type", "anomaly")
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
    .select("latitude, longitude, accuracy_meters, recorded_at")
    .eq("child_id", childId)
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      history: sorted,
      current: {
        latitude,
        longitude,
        accuracy_meters: null,
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
      event_type: "anomaly",
      title: "Unusual movement notice",
      details,
      anomaly_score: score,
      latitude,
      longitude,
      occurred_at: recordedAt,
    });

  if (insertError) {
    console.error("anomaly event insert failed", insertError);
    return;
  }

  await sendGuardianPush(
    supabase,
    guardianId,
    "SafeTrack unusual movement notice",
    details,
    {
      type: "anomaly",
      childId,
      locationLogId,
      anomalyScore: score,
    },
  );
}
