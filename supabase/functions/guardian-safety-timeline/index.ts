import { json, options } from "../_shared/response.ts";
import { findGuardianProfile, requireUser } from "../_shared/identity.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return options();

  try {
    const supabase = serviceClient();
    const user = await requireUser(supabase, request);
    const guardian = await findGuardianProfile(supabase, user);
    if (!guardian) return json({ error: "Guardian profile was not found." }, 403);

    const body = await request.json().catch(() => ({}));
    const childId = String(body.childId ?? "").trim();
    const startAt = String(body.startAt ?? "").trim() || null;
    const endAt = String(body.endAt ?? "").trim() || null;

    if (!childId) return json({ error: "childId is required." }, 400);

    const { data: child, error: childError } = await supabase
      .from("child_profiles")
      .select("id, guardian_id, full_name")
      .eq("id", childId)
      .maybeSingle();

    if (childError) throw childError;
    if (!child || child.guardian_id !== guardian.id) {
      return json({ error: "Child history is not authorized." }, 403);
    }

    let eventQuery = supabase
      .from("geofence_events")
      .select("id, event_type, title, details, anomaly_score, latitude, longitude, occurred_at")
      .eq("child_id", childId)
      .order("occurred_at", { ascending: false })
      .limit(500);

    let sosQuery = supabase
      .from("sos_alerts")
      .select("id, status, activation_method, latitude, longitude, triggered_at, acknowledged_at")
      .eq("child_id", childId)
      .order("triggered_at", { ascending: false })
      .limit(500);

    let locationCountQuery = supabase
      .from("location_logs")
      .select("id", { count: "exact", head: true })
      .eq("child_id", childId);

    if (startAt) {
      eventQuery = eventQuery.gte("occurred_at", startAt);
      sosQuery = sosQuery.gte("triggered_at", startAt);
      locationCountQuery = locationCountQuery.gte("recorded_at", startAt);
    }
    if (endAt) {
      eventQuery = eventQuery.lte("occurred_at", endAt);
      sosQuery = sosQuery.lte("triggered_at", endAt);
      locationCountQuery = locationCountQuery.lte("recorded_at", endAt);
    }

    const [eventResult, sosResult, locationCountResult] = await Promise.all([
      eventQuery,
      sosQuery,
      locationCountQuery,
    ]);

    if (eventResult.error) throw eventResult.error;
    if (sosResult.error) throw sosResult.error;
    if (locationCountResult.error) throw locationCountResult.error;

    return json({
      ok: true,
      child: { id: child.id, fullName: child.full_name },
      counts: {
        locationRecords: locationCountResult.count ?? 0,
        safetyEvents: eventResult.data?.length ?? 0,
        sosAlerts: sosResult.data?.length ?? 0,
      },
      events: eventResult.data ?? [],
      sosAlerts: sosResult.data ?? [],
    });
  } catch (error) {
    console.error("[guardian-safety-timeline]", error);
    const message = error instanceof Error ? error.message : "Unable to load SafeTrack history.";
    if (["AUTH_REQUIRED", "AUTH_INVALID"].includes(message)) {
      return json({ error: "Guardian authentication is required." }, 401);
    }
    return json({ error: message }, 500);
  }
});
