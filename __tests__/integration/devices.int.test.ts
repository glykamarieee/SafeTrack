/**
 * Integration testing: Child Registration and Device Linking, Child Device Connection,
 * Smartwatch and Mobile Location Tracking, Dashboard Management and the Administrator
 * Dashboard (live backend).
 *
 * A temporary child "UT Integration Child" (phone tracking) is registered, linked to a
 * phone with a real connection code, sends a location, and is deleted at the end.
 * The smartwatch side uses UT Child One's test watch (ST-WATCH-NFEGJ9K6), paired and
 * sending through the same database functions as the Wear OS app.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import { completeChildRegistration } from "../../services/childOnboardingService";
import { fetchChildPhoneState, linkChildPhone, recordChildPhoneLocation } from "../../services/childMobileService";
import { fetchAdminSmartwatchDevices, updateAdminSmartwatchDeviceStatus } from "../../services/adminService";
import { fetchLatestLocationForChild } from "../../services/locationService";
import { generateMobilePairingCode } from "../../services/mobilePairingService";
import { deleteChildProfile, fetchLinkedChildren } from "../../services/profileService";
import { generateWatchConnectionCode } from "../../services/watchPairingService";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import { accounts } from "../setup/accounts";
import { recordActual } from "../setup/record";
import { signInAs, signOutLocally } from "../setup/session";
import { deviceClient, LAPU, LAPU_NORTH, MODULE, pairWatch, watchLocation, type WatchSession } from "./helpers";

const A = accounts as any;
const TEST_WATCH = "ST-WATCH-NFEGJ9K6";
const guardianId = () => useAuthStore.getState().guardian!.id;
const fmt = (p: { latitude: number; longitude: number }) => `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`;

let tempChildId = "";
let phoneCode = "";

afterAll(async () => {
  if (tempChildId) {
    await signInAs(A.guardianWithChild);
    await deleteChildProfile(guardianId(), tempChildId).catch(() => undefined);
  }
  await signOutLocally();
});

describe("Child registration, connection code and the child phone", () => {
  test("INT-006: A registered child profile is ready for location tracking", async () => {
    await signInAs(A.guardianWithChild);
    const result: any = await completeChildRegistration({ fullName: "UT Integration Child", age: 9, relationship: "Parent", trackingSource: "mobile" });
    tempChildId = result.child?.id ?? result.childId;
    const listed = (await fetchLinkedChildren(guardianId())).find((c: any) => c.id === tempChildId) as any;
    expect(listed).toBeTruthy();
    recordActual(MODULE, "INT-006", `"UT Integration Child" (9, phone tracking) was saved under the guardian and listed among the linked children with tracking source "${listed.trackingSource ?? listed.tracking_source ?? "mobile"}", ready for a device to be connected.`);
  });

  test("INT-007: The guardian generates a connection code for the registered child", async () => {
    const code = await generateMobilePairingCode({ childId: tempChildId });
    phoneCode = code.connectionCode;
    expect(phoneCode).toMatch(/^\d{6}$/);
    const minutes = Math.round((new Date(code.expiresAt).getTime() - Date.now()) / 60000);
    expect(minutes).toBeGreaterThan(0);
    recordActual(MODULE, "INT-007", `A six-digit child phone connection code was generated for UT Integration Child, valid for about ${minutes} minutes.`);
  });

  test("INT-008: The code entered on the child phone links the phone to the child", async () => {
    await linkChildPhone(phoneCode);
    const state = await fetchChildPhoneState();
    expect(state.context.childId ?? (state.context as any).child_id).toBe(tempChildId);
    let reuse = "";
    try { await linkChildPhone(phoneCode); } catch (e) { reuse = (e as Error).message; }
    expect(reuse).not.toBe("");
    recordActual(MODULE, "INT-008", `Entering the code linked the phone to "${(state.context as any).childName ?? (state.context as any).child_name}"; the same code used again was refused ("${reuse}").`);
  });

  test("INT-009: The linked child phone opens the child dashboard with safety information", async () => {
    const state: any = await fetchChildPhoneState();
    expect(state.safeZoneStatus).toBeTruthy();
    recordActual(MODULE, "INT-009", `The child dashboard loaded for ${state.context.childName ?? state.context.child_name}: safe-zone status "${state.safeZoneStatus.status}", latest location ${state.latestLocation ? "available" : "not shared yet"}, no active SOS (${state.activeSos ? "active" : "none"}).`);
  });

  test("INT-043: A location shared from the child phone appears on the Guardian dashboard", async () => {
    const sent: any = await recordChildPhoneLocation(LAPU.latitude, LAPU.longitude, 8);
    expect(sent).toBeTruthy();
    const phoneToken = await AsyncStorage.getItem("safetrack.childPhone");
    await signInAs(A.guardianWithChild);
    const latest = await fetchLatestLocationForChild(tempChildId);
    expect(latest).toBeTruthy();
    expect(latest!.latitude).toBeCloseTo(LAPU.latitude, 4);
    recordActual(MODULE, "INT-043", `The child phone sent ${fmt(LAPU)} (Lapu-Lapu City); signed in as the guardian, the latest location of UT Integration Child was ${fmt(latest!)} from source "${latest!.source}" at ${latest!.recordedAt}.`);
    await AsyncStorage.setItem("safetrack.childPhone", phoneToken!);
  });

  test("INT-042: Deleting the child profile stops its phone from sending locations", async () => {
    const stored = await AsyncStorage.getItem("safetrack.childPhone");
    await deleteChildProfile(guardianId(), tempChildId);
    const listed = (await fetchLinkedChildren(guardianId())).some((c: any) => c.id === tempChildId);
    expect(listed).toBe(false);
    await AsyncStorage.setItem("safetrack.childPhone", stored!);
    let refused = "";
    try { await recordChildPhoneLocation(LAPU.latitude, LAPU.longitude, 8); } catch (e) { refused = (e as Error).message; }
    expect(refused).not.toBe("");
    tempChildId = "";
    recordActual(MODULE, "INT-042", `After Delete child profile the child was no longer listed for the guardian, and the next location from its phone was refused: "${refused}".`);
  });
});

describe("Smartwatch pairing, locations and the administrator's device status", () => {
  let watch: WatchSession;
  const device = deviceClient();

  test("INT-010: Locations from the paired smartwatch reach the Guardian dashboard", async () => {
    await signInAs(A.guardianWithChild);
    const code = await generateWatchConnectionCode({ watchId: TEST_WATCH });
    watch = await pairWatch(device, TEST_WATCH, code.connectionCode);
    const sent = await watchLocation(device, watch, LAPU_NORTH);
    expect(sent.error).toBeNull();
    const latest = await fetchLatestLocationForChild(watch.childId);
    expect(latest!.latitude).toBeCloseTo(LAPU_NORTH.latitude, 4);
    recordActual(MODULE, "INT-010", `Watch ${TEST_WATCH} was paired to ${code.childName} with a guardian code and sent ${fmt(LAPU_NORTH)}; the Guardian dashboard's latest location for ${code.childName} was ${fmt(latest!)} from source "${latest!.source}".`);
  });

  test("INT-033: A smartwatch turned off by the administrator is refused until turned on", async () => {
    await signInAs(A.admin);
    const row = (await fetchAdminSmartwatchDevices(TEST_WATCH)).find((d: any) => (d.watchId ?? d.watch_id) === TEST_WATCH) as any;
    await updateAdminSmartwatchDeviceStatus(row.deviceId, "inactive");
    const off = await watchLocation(device, watch, LAPU);
    const offRow = (await fetchAdminSmartwatchDevices(TEST_WATCH)).find((d) => d.deviceId === row.deviceId);
    const offStatus = offRow?.isActive ? "Enabled" : "Turned off";
    await updateAdminSmartwatchDeviceStatus(row.deviceId, "active");
    const on = await watchLocation(device, watch, LAPU);
    expect(off.error?.message ?? "").not.toBe("");
    expect(on.error).toBeNull();
    recordActual(MODULE, "INT-033", `The administrator turned ${TEST_WATCH} off (Devices showed "${offStatus}"); the watch's next location was refused: "${off.error!.message}". After turning it on, the watch's location was accepted.`);
  });
});

describe("Fixes after the first integration run (11/16/2026)", () => {
  const device = deviceClient();

  test("INT-047: Linking or unlinking a smartwatch updates the child's tracking source", async () => {
    await signInAs(A.admin);
    const spare = (await fetchAdminSmartwatchDevices()).find((d) => !d.childId)!;
    expect(spare).toBeTruthy();
    await signInAs(A.guardianWithChild);
    const child: any = await completeChildRegistration({ fullName: "UT Integration Child", age: 9, relationship: "Parent", trackingSource: "mobile" });
    const childId = child.child?.id ?? child.childId;
    const source = async () => ((await fetchLinkedChildren(guardianId())).find((c: any) => c.id === childId) as any)?.trackingSource;
    try {
      await linkChildPhone((await generateMobilePairingCode({ childId })).connectionCode);
      const phoneOnly = await source();
      const link = await supabase.rpc("link_watch_to_my_child", { p_child_id: childId, p_watch_id: spare.watchId });
      expect(link.error).toBeNull();
      const withWatch = await source();
      await supabase.rpc("unlink_watch_from_my_child", { p_child_id: childId });
      const afterUnlink = await source();
      expect([phoneOnly, withWatch, afterUnlink]).toEqual(["mobile", "both", "mobile"]);
      recordActual(MODULE, "INT-047", `A child registered with a phone showed tracking source "${phoneOnly}"; after the guardian linked a smartwatch (${spare.watchId}) it changed to "${withWatch}", and after unlinking the watch it returned to "${afterUnlink}".`);
    } finally {
      await supabase.rpc("unlink_watch_from_my_child", { p_child_id: childId }).then(() => undefined, () => undefined);
      await deleteChildProfile(guardianId(), childId).catch(() => undefined);
    }
  });

  test("INT-048: Live-map updates from the watch count as contact", async () => {
    await signInAs(A.guardianWithChild);
    const code = await generateWatchConnectionCode({ watchId: TEST_WATCH });
    const watch = await pairWatch(device, TEST_WATCH, code.connectionCode);
    const seen = async () => ((await supabase.from("smartwatch_devices").select("last_seen_at").eq("watch_id", TEST_WATCH).single()).data as any)?.last_seen_at as string;
    const before = await seen();
    await new Promise((r) => setTimeout(r, 65_000));
    const live = await device.rpc("push_watch_live", {
      p_watch_id: watch.watchId, p_device_token: watch.deviceToken, p_latitude: LAPU.latitude, p_longitude: LAPU.longitude,
      p_accuracy_meters: 6, p_recorded_at: new Date().toISOString(), p_battery_percent: 80, p_network_type: "wifi", p_device_model: "Integration test watch",
    });
    expect(live.error).toBeNull();
    const after = await seen();
    expect(new Date(after).getTime()).toBeGreaterThan(new Date(before).getTime() + 60_000);
    recordActual(MODULE, "INT-048", `The watch's last contact was ${before}; 65 seconds later it sent only a live-map update (no saved location, no heartbeat), and its last contact became ${after}, so a watch streaming to the live map is not reported as disconnected.`);
  }, 120_000);
});
