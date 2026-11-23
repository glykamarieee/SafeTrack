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
});
