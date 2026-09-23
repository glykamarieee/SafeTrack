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
  const earthRadius = 6371000;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return (
    2 *
    earthRadius *
    Math.asin(Math.sqrt(a))
  );
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



  const {
    data: zones,
    error: zoneError,
  } = await supabase
    .from("geofences")
    .select(
      `
      id,
      name,
      latitude,
      longitude,
      radius_meters,
      is_enabled
      `,
    )
    .eq("child_id", childId)
    .eq("is_enabled", true);



  if (zoneError) {
    throw zoneError;
  }



  if (!zones || zones.length === 0) {
    return "No safe zone configured";
  }



  const insideZones: string[] = [];



  for (const zone of zones) {


    const zoneLatitude = Number(zone.latitude);

    const zoneLongitude = Number(zone.longitude);

    const radius = Number(zone.radius_meters);



    const distance = distanceMeters(
      latitude,
      longitude,
      zoneLatitude,
      zoneLongitude,
    );



    const isInside =
      distance <= radius;



    if (isInside) {
      insideZones.push(zone.name);
    }



    /*
      Get previous safe-zone state.

      entry = previously inside
      exit  = previously outside
    */

    const {
      data: lastEvent,
    } = await supabase
      .from("geofence_events")
      .select(
        "event_type",
      )
      .eq(
        "child_id",
        childId,
      )
      .eq(
        "geofence_id",
        zone.id,
      )
      .in(
        "event_type",
        [
          "entry",
          "exit",
        ],
      )
      .order(
        "occurred_at",
        {
          ascending: false,
        },
      )
      .limit(1)
      .maybeSingle();



    let previousInside:
      | boolean
      | null = null;



    if (lastEvent?.event_type === "entry") {

      previousInside = true;

    } else if (
      lastEvent?.event_type === "exit"
    ) {

      previousInside = false;

    }



    /*
      If there is no previous event,
      create an event only when child
      is initially inside the zone.
    */

    const stateChanged =
      previousInside === null
        ? isInside
        : previousInside !== isInside;



    if (!stateChanged) {
      continue;
    }



    const eventType =
      isInside
        ? "entry"
        : "exit";



    const title =
      isInside
        ? `Entered ${zone.name}`
        : `Exited ${zone.name}`;



    const details =
      isInside
        ? `The child entered the ${zone.name} safe zone.`
        : `The child exited the ${zone.name} safe zone.`;



    const {
      error: insertError,
    } = await supabase
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

        occurred_at:
          new Date().toISOString(),

      });



    if (insertError) {

      console.error(
        "Failed to insert geofence event:",
        insertError,
      );

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



  return insideZones.length > 0
    ? `Inside ${insideZones.join(", ")}`
    : "Outside safe zones";

}