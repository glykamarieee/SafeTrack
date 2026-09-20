import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { sendGuardianPush } from "./push.ts";

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const earthRadius = 6_371_000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

export async function processGeofences(args: {
  supabase: SupabaseClient;
  childId: string;
  guardianId: string;
  locationLogId: string;
  latitude: number;
  longitude: number;
}) {
  const {
    supabase,
    childId,
    guardianId,
    locationLogId,
    latitude,
    longitude,
  } = args;

  const { data: zones, error } = await supabase
    .from("geofences")
    .select("id, name, latitude, longitude, radius_meters, is_enabled")
    .eq("child_id", childId)
    .eq("is_enabled", true);

  if (error) throw error;

  if (!zones || zones.length === 0) {
    return "No safe zone configured";
  }

  const insideNames: string[] = [];

  for (const zone of zones) {
    const distance = distanceMeters(
      latitude,
      longitude,
      Number(zone.latitude),
      Number(zone.longitude),
    );

    const inside = distance <= Number(zone.radius_meters);

    if (inside) insideNames.push(zone.name);

    const { data: lastEvent } = await supabase
      .from("geofence_events")
      .select("event_type")
      .eq("child_id", childId)
      .eq("geofence_id", zone.id)
      .in("event_type", ["entry", "exit"])
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const previousInside =
      lastEvent?.event_type === "entry"
        ? true
        : lastEvent?.event_type === "exit"
        ? false
        : null;

    const changed =
      previousInside === null ? inside : previousInside !== inside;

    if (!changed) continue;

    const eventType = inside ? "entry" : "exit";
    const title = inside
      ? `Entered ${zone.name}`
      : `Exited ${zone.name}`;

    const details = inside
      ? `The registered smartwatch entered the ${zone.name} safe zone.`
      : `The registered smartwatch exited the ${zone.name} safe zone.`;

    const { error: insertError } = await supabase
      .from("geofence_events")
      .insert({
        child_id: childId,
        geofence_id: zone.id,
        location_log_id: locationLogId,
        event_type: eventType,
        title,
        details,
        latitude,
        longitude,
        occurred_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error("geofence event insert failed", insertError);
      continue;
    }

    await sendGuardianPush(
      supabase,
      guardianId,
      title,
      details,
      {
        type: "geofence",
        eventType,
        childId,
        geofenceId: zone.id,
        locationLogId,
      },
    );
  }

  return insideNames.length > 0
    ? `Inside ${insideNames.join(", ")}`
    : "Outside safe zones";
}
