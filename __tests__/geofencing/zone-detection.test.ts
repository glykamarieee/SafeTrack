/**
 * Unit testing, AI Anomaly Detection & Geofencing Module: Safe-Zone Entry and
 * Exit Detection (CASE-055 to CASE-057).
 *
 * The test guardian makes temporary zones for UT Child Two (deleted at the
 * end). Locations are then sent the way the paired child phone sends them
 * (the real recordChildPhoneLocation, with the phone's saved link), and the
 * entry/exit records the server writes are read back as the guardian.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "../../lib/supabase";
import { recordChildPhoneLocation } from "../../services/childMobileService";
import { createGeofence, deleteGeofence, fetchGeofences } from "../../services/geofenceService";
import { useAuthStore } from "../../store/authStore";
import { accounts } from "../setup/accounts";
import { recordActual } from "../setup/record";
import { signInAs, signOutLocally } from "../setup/session";

const MODULE = "geofencing";
const CHILD = accounts.childPhone.childId;
const TAG = String(Date.now()).slice(-5);
const CENTER = { latitude: 7.3, longitude: 125.4 };
// About 1.1 km north of the center, well outside a 100 m zone.
const OUTSIDE = { latitude: 7.31, longitude: 125.4 };

const made: string[] = [];

async function makeZone(name: string, isEnabled: boolean) {
  const guardianId = useAuthStore.getState().guardian!.id;
  await createGeofence({ guardianId, childId: CHILD, name, address: "", ...CENTER, radiusMeters: 100, isEnabled });
  const zone = (await fetchGeofences(guardianId, CHILD)).find((item) => item.name === name)!;
  made.push(zone.id);
  return zone;
}

/** Sends one location as the child's phone. */
async function phoneAt(point: { latitude: number; longitude: number }) {
  await AsyncStorage.setItem("safetrack.childPhone", JSON.stringify(accounts.childPhone));
  return recordChildPhoneLocation(point.latitude, point.longitude, 8);
}

async function eventsFor(zoneId: string, since: string) {
  const { data, error } = await supabase
    .from("geofence_events")
    .select("event_type, title, occurred_at")
    .eq("geofence_id", zoneId)
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

let zoneId = "";
let since = "";

describe("Safe-Zone Entry and Exit Detection", () => {
  beforeAll(async () => {
    await signInAs(accounts.guardianWithChild, CHILD);
  });

  // Inside the describe, so it runs while still signed in (the shared
  // after-all hook signs out first).
  afterAll(async () => {
    for (const id of made) await deleteGeofence(id).catch(() => undefined);
    await signOutLocally();
  });

  test("CASE-055: Latest location moves from outside to inside an enabled zone", async () => {
    const zone = await makeZone(`UT Zone Entry ${TAG}`, true);
    zoneId = zone.id;
    since = new Date(Date.now() - 60_000).toISOString();

    const before = await phoneAt(OUTSIDE);
    expect(before.safeZoneStatus.status).toBe("outside");
    const inside = await phoneAt(CENTER);
    expect(inside.safeZoneStatus.status).toBe("inside");

    const events = await eventsFor(zoneId, since);
    expect(events.map((event) => event.event_type)).toEqual(["entry"]);
    recordActual(
      MODULE,
      "CASE-055",
      `The phone's location moved from 1.1 km away to the zone center: status changed outside → inside and one entry event was recorded ("${events[0]!.title}").`,
    );
  });

  test("CASE-056: Latest location moves from inside to outside an enabled zone", async () => {
    const after = await phoneAt(OUTSIDE);
    expect(after.safeZoneStatus.status).toBe("outside");

    const events = await eventsFor(zoneId, since);
    expect(events.map((event) => event.event_type)).toEqual(["entry", "exit"]);
    recordActual(
      MODULE,
      "CASE-056",
      `The location moved back out of the zone: status changed inside → outside and one exit event was recorded ("${events[1]!.title}").`,
    );
  });

  test("CASE-057: Location is recorded for a disabled safe zone", async () => {
    // Only the disabled zone is at this spot now.
    await deleteGeofence(zoneId);
    const zone = await makeZone(`UT Zone Off ${TAG}`, false);
    const start = new Date(Date.now() - 1000).toISOString();

    const inside = await phoneAt(CENTER);
    const outside = await phoneAt(OUTSIDE);
    expect(inside.location.latitude).toBeCloseTo(CENTER.latitude, 4);
    // A disabled zone is ignored: the child is never counted as inside it.
    expect(inside.safeZoneStatus.status).not.toBe("inside");
    expect(outside.safeZoneStatus.status).not.toBe("inside");

    expect(await eventsFor(zone.id, start)).toEqual([]);
    recordActual(
      MODULE,
      "CASE-057",
      `Locations at the center of a disabled zone and outside it were both saved, but the zone was ignored ("${inside.safeZoneStatus.message}") and no entry or exit event was recorded.`,
    );
  });
});
