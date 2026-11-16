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
