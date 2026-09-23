import { json, options } from "../_shared/response.ts";
import { authenticateWatch } from "../_shared/device-auth.ts";
import { processGeofences } from "../_shared/geofence.ts";
import { reviewAnomaly } from "../_shared/anomaly.ts";

function numberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validLatitude(value: number | null) {
  return value !== null && value >= -90 && value <= 90;
}

function validLongitude(value: number | null) {
  return value !== null && value >= -180 && value <= 180;
}

async function childContext(
  supabase: any,
  childId: string,
) {
  const { data: child, error } = await supabase
    .from("children")
    .select("id, full_name, guardian_id")
    .eq("id", childId)
    .maybeSingle();

  if (error) throw error;
  if (!child) throw new Error("Child profile was not found.");

  return child;
}

async function insertLocation(
  supabase: any,
  childId: string,
  body: any,
) {
  const latitude = numberOrNull(body.latitude);
  const longitude = numberOrNull(body.longitude);
  const accuracyMeters = numberOrNull(body.accuracyMeters);

  if (!validLatitude(latitude) || !validLongitude(longitude)) {
    throw new Error("Invalid smartwatch location coordinates.");
  }

  const recordedAt =
    typeof body.recordedAt === "string" && body.recordedAt
      ? body.recordedAt
      : new Date().toISOString();

  const { data: location, error } = await supabase
    .from("location_logs")
    .insert({
      child_id: childId,
      source: "smartwatch",
      latitude,
      longitude,
      accuracy_meters: accuracyMeters,
      recorded_at: recordedAt,
    })
    .select("id, latitude, longitude, accuracy_meters, recorded_at")
    .single();

  if (error) throw error;
  return location;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return options();

  try {
    const { supabase, device } = await authenticateWatch(request);
    const body = await request.json();
    const type = String(body.type ?? "").trim();

    const now = new Date().toISOString();

    const { error: seenError } = await supabase
      .from("smartwatch_devices")
      .update({
        last_seen_at: now,
        last_verified_at: now,
        updated_at: now,
      })
      .eq("id", device.id);

    if (seenError) throw seenError;

    // Rejects watches whose child profile was deleted.
    const child = await childContext(supabase as any, device.child_id);

    if (type === "heartbeat") {
      const { data: latest } = await supabase
        .from("location_logs")
        .select("id, latitude, longitude")
        .eq("child_id", device.child_id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let safeZoneStatus = "Waiting for location";

      if (latest) {
        safeZoneStatus = await processGeofences({
          supabase,
          childId: device.child_id,
          locationLogId: latest.id,
        });
      }

      return json({
        ok: true,
        deviceActive: true,
        safeZoneStatus,
      });
    }

    if (type === "location") {
      const location = await insertLocation(
        supabase,
        device.child_id,
        body,
      );

      const safeZoneStatus = await processGeofences({
        supabase,
        childId: device.child_id,
        locationLogId: location.id,
      });

      await reviewAnomaly({
        supabase,
        childId: device.child_id,
        locationLogId: location.id,
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        recordedAt: location.recorded_at,
      });

      return json({
        ok: true,
        deviceActive: true,
        locationLogId: location.id,
        safeZoneStatus,
      });
    }

    if (type === "sos") {
      // Must match sos_alerts_activation_method_check.
      const activationMethod =
        body.activationMethod === "shake"
          ? "shake"
          : "tap_and_hold";

      let locationLogId: string | null = null;
      let latitude: number | null = null;
      let longitude: number | null = null;
      let accuracyMeters: number | null = null;

      if (
        validLatitude(numberOrNull(body.latitude)) &&
        validLongitude(numberOrNull(body.longitude))
      ) {
        const location = await insertLocation(
          supabase,
          device.child_id,
          body,
        );

        locationLogId = location.id;
        latitude = Number(location.latitude);
        longitude = Number(location.longitude);
        accuracyMeters = location.accuracy_meters === null
          ? null
          : Number(location.accuracy_meters);
      } else {
        const { data: latest } = await supabase
          .from("location_logs")
          .select("id, latitude, longitude, accuracy_meters")
          .eq("child_id", device.child_id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latest) {
          locationLogId = latest.id;
          latitude = Number(latest.latitude);
          longitude = Number(latest.longitude);
          accuracyMeters = latest.accuracy_meters === null
            ? null
            : Number(latest.accuracy_meters);
        }
      }

      const triggeredAt =
        typeof body.triggeredAt === "string" && body.triggeredAt
          ? body.triggeredAt
          : now;

      const { data: sos, error: sosError } = await supabase
        .from("sos_alerts")
        .insert({
          child_id: device.child_id,
          guardian_id: child.guardian_id,
          location_log_id: locationLogId,
          activation_method: activationMethod,
          status: "active",
          location_source: locationLogId ? "smartwatch" : null,
          latitude,
          longitude,
          accuracy_meters: accuracyMeters,
          triggered_at: triggeredAt,
          realert_count: 0,
          is_test: false,
        })
        .select("id")
        .single();

      // The Guardian is notified by the sos_alerts_notify_guardian trigger.
      if (sosError) throw sosError;

      return json({
        ok: true,
        deviceActive: true,
        sosAlertId: sos.id,
        locationLogId,
        safeZoneStatus: "SOS active",
      });
    }

    if (type === "cancel_sos") {
      const sosAlertId = String(body.sosAlertId ?? "").trim();

      if (!sosAlertId) {
        return json({ error: "sosAlertId is required." }, 400);
      }

      const { error: cancelError } = await supabase
        .from("sos_alerts")
        .update({
          status: "cancelled",
          updated_at: now,
        })
        .eq("id", sosAlertId)
        .eq("child_id", device.child_id)
        .eq("status", "active");

      if (cancelError) throw cancelError;

      return json({
        ok: true,
        deviceActive: true,
        sosAlertId,
      });
    }

    return json({ error: "Unsupported watch event type." }, 400);
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error ? error.message : "SafeTrack watch request failed.";

    const status =
      /authentication|disabled|not registered|not active/i.test(message)
        ? 403
        : 500;

    return json(
      {
        error: message,
        deviceActive: status !== 403,
      },
      status,
    );
  }
});
