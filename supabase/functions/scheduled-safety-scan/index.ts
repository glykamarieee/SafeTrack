import { json, options } from "../_shared/response.ts";
import { serviceClient } from "../_shared/supabase.ts";

function seconds(value: string | undefined, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function hasRecentEvent(
  supabase: any,
  childId: string,
  eventType: string,
  cooldownSeconds: number,
) {
  const threshold = new Date(Date.now() - cooldownSeconds * 1000).toISOString();
  const { data } = await supabase
    .from("geofence_events")
    .select("id")
    .eq("child_id", childId)
    .eq("event_type", eventType)
    .gte("occurred_at", threshold)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

// The Guardian is notified by the geofence_events_notify_guardian trigger.
async function createSafetyEvent(args: {
  supabase: any;
  childId: string;
  eventType: string;
  title: string;
  details: string;
  cooldownSeconds: number;
}) {
  const {
    supabase,
    childId,
    eventType,
    title,
    details,
    cooldownSeconds,
  } = args;

  if (await hasRecentEvent(supabase, childId, eventType, cooldownSeconds)) {
    return false;
  }

  const { error } = await supabase
    .from("geofence_events")
    .insert({
      child_id: childId,
      geofence_id: null,
      location_log_id: null,
      event_type: eventType,
      title,
      details,
      latitude: null,
      longitude: null,
      occurred_at: new Date().toISOString(),
    });

  if (error) throw error;

  return true;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return options();

  const expectedSecret = Deno.env.get("CRON_SECRET") ?? "";
  const providedSecret = request.headers.get("x-cron-secret") ?? "";

  if (!expectedSecret || expectedSecret !== providedSecret) {
    return json({ error: "Unauthorized scheduled request." }, 401);
  }

  try {
    const supabase = serviceClient();
    const disconnectSeconds = seconds(
      Deno.env.get("WATCH_DISCONNECT_SECONDS"),
      300,
    );
    const inactivitySeconds = seconds(
      Deno.env.get("PROLONGED_INACTIVITY_SECONDS"),
      1800,
    );
    const cooldownSeconds = seconds(
      Deno.env.get("RULE_ALERT_COOLDOWN_SECONDS"),
      3600,
    );

    const { data: devices, error } = await supabase
      .from("smartwatch_devices")
      .select(
        "id, watch_id, child_id, is_active, last_seen_at, last_location_at",
      )
      .eq("is_active", true)
      .not("child_id", "is", null);

    if (error) throw error;

    let disconnected = 0;
    let inactivity = 0;

    for (const device of devices ?? []) {
      const { data: child, error: childError } = await supabase
        .from("children")
        .select("id, full_name, guardian_id")
        .eq("id", device.child_id)
        .maybeSingle();

      if (childError || !child) continue;

      const lastSeenMs = device.last_seen_at
        ? new Date(device.last_seen_at).getTime()
        : 0;
      const lastLocationMs = device.last_location_at
        ? new Date(device.last_location_at).getTime()
        : 0;

      const disconnectedNow =
        !lastSeenMs || Date.now() - lastSeenMs > disconnectSeconds * 1000;

      if (disconnectedNow) {
        const created = await createSafetyEvent({
          supabase,
          childId: child.id,
          eventType: "watch_disconnected",
          title: "Smartwatch connection unavailable",
          details:
            `${child.full_name}'s registered smartwatch has not contacted SafeTrack ` +
            `within the configured ${Math.round(disconnectSeconds / 60)}-minute period. ` +
            "Check the watch power, network connection, and app status.",
          cooldownSeconds,
        });
        if (created) disconnected += 1;
        continue;
      }

      // Only classify missing location as prolonged inactivity while the watch
      // itself is still communicating. A disconnected watch is handled above.
      const noRecentLocation =
        !lastLocationMs || Date.now() - lastLocationMs > inactivitySeconds * 1000;

      if (noRecentLocation) {
        const created = await createSafetyEvent({
          supabase,
          childId: child.id,
          eventType: "prolonged_inactivity",
          title: "Prolonged inactivity notice",
          details:
            `${child.full_name}'s smartwatch is online but SafeTrack has not received a ` +
            `recent usable location for the configured ${Math.round(inactivitySeconds / 60)}-minute period. ` +
            "This may reflect limited movement, GPS availability, or another device condition.",
          cooldownSeconds,
        });
        if (created) inactivity += 1;
      }
    }

    return json({
      ok: true,
      scanned: devices?.length ?? 0,
      disconnectedEventsCreated: disconnected,
      inactivityEventsCreated: inactivity,
    });
  } catch (error) {
    console.error("[scheduled-safety-scan]", error);
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Scheduled safety scan failed.",
      },
      500,
    );
  }
});
