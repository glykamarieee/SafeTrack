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

describe("Smartwatch pairing, locations and the administrator's device status", () => {
  let watch: WatchSession;
  const device = deviceClient();

  // Setup: earlier cases this case builds on, run as steps (not counted as tests).
  beforeAll(async () => {
await (async () => {
    await signInAs(A.guardianWithChild);
    const code = await generateWatchConnectionCode({ watchId: TEST_WATCH });
    watch = await pairWatch(device, TEST_WATCH, code.connectionCode);
    const sent = await watchLocation(device, watch, LAPU_NORTH);
    expect(sent.error).toBeNull();
    const latest = await fetchLatestLocationForChild(watch.childId);
    expect(latest!.latitude).toBeCloseTo(LAPU_NORTH.latitude, 4);
    recordActual(MODULE, "INT-010", `Watch ${TEST_WATCH} was paired to ${code.childName} with a guardian code and sent ${fmt(LAPU_NORTH)}; the Guardian dashboard's latest location for ${code.childName} was ${fmt(latest!)} from source "${latest!.source}".`);
  })();
    jest.clearAllMocks();
  }, 900_000);
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
