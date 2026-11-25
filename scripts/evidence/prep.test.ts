/**
 * Test data for the unit-testing screenshots on the real phone (not a test case).
 * Run: npx jest --testMatch "**\/scripts/evidence/*.test.ts" --forceExit   with PREP_STEP set:
 *   lapu           UT Child Two's child phone sends test locations in Lapu-Lapu City: outside,
 *                  inside and outside a temporary zone "UT Zone Lapu-Lapu" (entry and exit events),
 *                  ending 1.1 km north of Lapu-Lapu City Hall; the zone is deleted afterwards.
 *   child3         adds "UT Child Three" (phone tracking, no location yet) for CASE-044.
 *   child3-delete  deletes "UT Child Three".
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import { completeChildRegistration } from "../../services/childOnboardingService";
import { recordChildPhoneLocation } from "../../services/childMobileService";
import { createGeofence, deleteGeofence, fetchGeofences } from "../../services/geofenceService";
import { deleteChildProfile, fetchLinkedChildren } from "../../services/profileService";
import { generateMobilePairingCode } from "../../services/mobilePairingService";
import { generateWatchConnectionCode } from "../../services/watchPairingService";
import { useAuthStore } from "../../store/authStore";
import { accounts } from "../../__tests__/setup/accounts";
import { signInAs, signOutLocally } from "../../__tests__/setup/session";

const A = accounts as any;
const LAPU = { latitude: 10.31646, longitude: 123.96523 };
const NORTH = { latitude: 10.32646, longitude: 123.96523 };
const step = process.env.PREP_STEP;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

afterAll(async () => {
  await signOutLocally();
});

test(`prepare ${step}`, async () => {
  await signInAs(A.guardianWithChild);
  const guardianId = useAuthStore.getState().guardian!.id;
  if (step === "lapu") {
    const child = A.childPhone.childId;
    await createGeofence({ guardianId, childId: child, name: "UT Zone Lapu-Lapu", address: "Lapu-Lapu City Hall", ...LAPU, radiusMeters: 100, isEnabled: true });
    const zone = (await fetchGeofences(guardianId, child)).find((z) => z.name === "UT Zone Lapu-Lapu")!;
    await AsyncStorage.setItem("safetrack.childPhone", JSON.stringify(A.childPhone));
    for (const p of [NORTH, LAPU, NORTH]) {
      const r = await recordChildPhoneLocation(p.latitude, p.longitude, 8);
      console.log("sent", p, r.safeZoneStatus.status);
      await wait(3000);
    }
    await deleteGeofence(zone.id);
  } else if (step === "child3") {
    const r: any = await completeChildRegistration({ fullName: "UT Child Three", age: 8, relationship: "Parent", trackingSource: "mobile" });
    console.log("added", r.child?.id ?? r.childId);
  } else if (step === "sosphone") {
    // A temporary child "UT SOS Phone" (phone tracking) and a code to link the emulator phone.
    const r: any = await completeChildRegistration({ fullName: "UT SOS Phone", age: 9, relationship: "Parent", trackingSource: "mobile" });
    const childId = r.child?.id ?? r.childId;

    console.log("PHONECODE", (await generateMobilePairingCode({ childId })).connectionCode);
  } else if (step === "sosphone-delete") {
    const c = (await fetchLinkedChildren(guardianId)).find((x: any) => (x.fullName ?? x.full_name) === "UT SOS Phone");
    if (c) await deleteChildProfile(guardianId, c.id);
    console.log("deleted", c?.id);
  } else if (step === "nolocsos") {
    // UT Child Three (no location ever) gets a linked test phone that sends an SOS: stored without a location.
    const c = (await fetchLinkedChildren(guardianId)).find((x: any) => (x.fullName ?? x.full_name) === "UT Child Three")!;
    const { linkChildPhone, triggerChildPhoneSos } = require("../../services/childMobileService");
    await linkChildPhone((await generateMobilePairingCode({ childId: c.id })).connectionCode);
    console.log("SOS", JSON.stringify(await triggerChildPhoneSos()));
  } else if (step === "linkwatch3") {
    // The Wear OS emulator's own Watch ID, linked to UT Child Three, plus a connection code.
    const { supabase } = require("../../lib/supabase");
    const c = (await fetchLinkedChildren(guardianId)).find((x: any) => (x.fullName ?? x.full_name) === "UT Child Three")!;
    const link = await supabase.rpc("link_watch_to_my_child", { p_child_id: c.id, p_watch_id: "ST-WATCH-CQGZ24GY" });
    if (link.error) throw link.error;
    console.log("WATCHCODE", (await generateWatchConnectionCode({ watchId: "ST-WATCH-CQGZ24GY" })).connectionCode);
  } else if (step === "ping") {
    // One location from the test child phone (UT Child Two), as the child app sends it: used to check
    // that an open guardian screen (phone or web) receives it in real time. PING_LAT/PING_LNG set the spot.
    await AsyncStorage.setItem("safetrack.childPhone", JSON.stringify(A.childPhone));
    const lat = Number(process.env.PING_LAT ?? LAPU.latitude), lng = Number(process.env.PING_LNG ?? LAPU.longitude);
    // Optional motion, as the child app sends it: PING_SPEED (m/s), PING_MODE, PING_HEADING (degrees).
    const motion = process.env.PING_MODE
      ? { speedMps: Number(process.env.PING_SPEED ?? 0), headingDegrees: Number(process.env.PING_HEADING ?? 45), mode: process.env.PING_MODE, confidence: 0.9 }
      : undefined;
    const r = await recordChildPhoneLocation(lat, lng, Number(process.env.PING_ACC ?? 8), motion as any);
    console.log("PING", lat, lng, process.env.PING_MODE ?? "-", r.safeZoneStatus.status);
  } else if (step === "phonecode") {
    // A phone connection code for the named test child (CHILD_NAME), to link a test phone or emulator.
    const c = (await fetchLinkedChildren(guardianId)).find((x: any) => (x.fullName ?? x.full_name) === process.env.CHILD_NAME)!;
    console.log("PHONECODE", (await generateMobilePairingCode({ childId: c.id })).connectionCode);
  } else if (step === "watchcode") {
    // A smartwatch connection code (for the test watch of UT Child One): used to show a watch code is refused on a phone.
    console.log("WATCHCODE", (await generateWatchConnectionCode({ watchId: process.env.WATCH_ID ?? "ST-WATCH-NFEGJ9K6" })).connectionCode);
  } else if (step === "zone-on") {
    // A 60 m test safe zone at Lapu-Lapu City Hall for the test child phone (UT Child Two), or CHILD_NAME.
    const zc = process.env.CHILD_NAME ? (await fetchLinkedChildren(guardianId)).find((x: any) => (x.fullName ?? x.full_name) === process.env.CHILD_NAME)!.id : A.childPhone.childId;
    await createGeofence({ guardianId, childId: zc, name: "UT Retake Zone", address: "Lapu-Lapu City Hall", ...LAPU, radiusMeters: 60, isEnabled: process.env.ZONE_ENABLED !== "false" });
    console.log("zone on");
  } else if (step === "zone-off") {
    const zc = process.env.CHILD_NAME ? (await fetchLinkedChildren(guardianId)).find((x: any) => (x.fullName ?? x.full_name) === process.env.CHILD_NAME)!.id : A.childPhone.childId;
    for (const z of await fetchGeofences(guardianId, zc)) if (z.name === "UT Retake Zone") await deleteGeofence(z.id);
    console.log("zone off");
  } else if (step === "zone-clean") {
    // Removes test zones left by test runs (names in ZONE_NAMES, comma-separated) for every linked child.
    const names = (process.env.ZONE_NAMES ?? "UT Integration Zone").split(",");
    for (const c of await fetchLinkedChildren(guardianId))
      for (const z of await fetchGeofences(guardianId, c.id)) if (names.includes(z.name)) { await deleteGeofence(z.id); console.log("deleted", z.name, c.id); }
  } else if (step === "live-jitter") {
    // Live (not saved) positions of the test child phone for an open guardian map: LIVE_M lists metres
    // north of Lapu-Lapu City Hall, one every LIVE_GAP ms, with accuracy LIVE_ACC (CASE-365).
    await AsyncStorage.setItem("safetrack.childPhone", JSON.stringify(A.childPhone));
    const { pushChildPhoneLive } = require("../../services/childMobileService");
    for (const m of (process.env.LIVE_M ?? "10").split(",").map(Number)) {
      const lat = LAPU.latitude + m / 111_320;
      const live = await pushChildPhoneLive(lat, LAPU.longitude, Number(process.env.LIVE_ACC ?? 10), Date.now(), { speedMps: 0.5, headingDegrees: 0, mode: "walking", confidence: 0.9 });
      console.log("LIVE", m, "m", "watching:", live, new Date().toISOString());
      await wait(Number(process.env.LIVE_GAP ?? 1500));
    }
  } else if (step === "sos") {
    // A real SOS from the test child phone (UT Child Two), as the child app sends it.
    await AsyncStorage.setItem("safetrack.childPhone", JSON.stringify(A.childPhone));
    const { triggerChildPhoneSos } = require("../../services/childMobileService");
    console.log("SOS", JSON.stringify(await triggerChildPhoneSos()));
  } else if (step === "ackall") {
    // Acknowledge any test SOS left active for the test guardian's children.
    const { fetchActiveSosAlerts, acknowledgeSosAlert } = require("../../services/sosService");
    for (const a of await fetchActiveSosAlerts()) {
      await acknowledgeSosAlert(a.id);
      console.log("acknowledged", a.id);
    }
  } else if (step === "sosphone-zone") {
    // A test safe zone at Lapu-Lapu City Hall for the emulator child phone ("UT SOS Phone").
    const c = (await fetchLinkedChildren(guardianId)).find((x: any) => (x.fullName ?? x.full_name) === "UT SOS Phone")!;
    await createGeofence({ guardianId, childId: c.id, name: "UT Zone City Hall", address: "Lapu-Lapu City Hall", ...LAPU, radiusMeters: 100, isEnabled: true });
    console.log("zone for", c.id);
  } else if (step === "addchild") {
    const r: any = await completeChildRegistration({ fullName: process.env.CHILD_NAME!, age: 8, relationship: "Parent", trackingSource: "mobile" });
    console.log("added", r.child?.id ?? r.childId);
  } else if (step === "delchild") {
    const c = (await fetchLinkedChildren(guardianId)).find((x: any) => (x.fullName ?? x.full_name) === process.env.CHILD_NAME);
    if (c) await deleteChildProfile(guardianId, c.id);
    console.log("deleted", c?.id);
  } else if (step === "watchcode") {

    console.log("WATCHCODE", (await generateWatchConnectionCode({ watchId: process.env.WATCH_ID ?? "ST-WATCH-NFEGJ9K6" })).connectionCode);
  } else if (step === "child3-delete") {
    const c = (await fetchLinkedChildren(guardianId)).find((x: any) => (x.fullName ?? x.full_name) === "UT Child Three");
    if (c) await deleteChildProfile(guardianId, c.id);
    console.log("deleted", c?.id);
  }
}, 120_000);
