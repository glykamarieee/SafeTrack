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

  // Setup: earlier cases this case builds on, run as steps (not counted as tests).
  beforeAll(async () => {
await (async () => {
    await signInAs(A.guardianWithChild);
    const result: any = await completeChildRegistration({ fullName: "UT Integration Child", age: 9, relationship: "Parent", trackingSource: "mobile" });
    tempChildId = result.child?.id ?? result.childId;
    const listed = (await fetchLinkedChildren(guardianId())).find((c: any) => c.id === tempChildId) as any;
    expect(listed).toBeTruthy();
    recordActual(MODULE, "INT-006", `"UT Integration Child" (9, phone tracking) was saved under the guardian and listed among the linked children with tracking source "${listed.trackingSource ?? listed.tracking_source ?? "mobile"}", ready for a device to be connected.`);
  })();
    jest.clearAllMocks();
await (async () => {
    const code = await generateMobilePairingCode({ childId: tempChildId });
    phoneCode = code.connectionCode;
    expect(phoneCode).toMatch(/^\d{6}$/);
    const minutes = Math.round((new Date(code.expiresAt).getTime() - Date.now()) / 60000);
    expect(minutes).toBeGreaterThan(0);
    recordActual(MODULE, "INT-007", `A six-digit child phone connection code was generated for UT Integration Child, valid for about ${minutes} minutes.`);
  })();
    jest.clearAllMocks();
await (async () => {
    await linkChildPhone(phoneCode);
    const state = await fetchChildPhoneState();
    expect(state.context.childId ?? (state.context as any).child_id).toBe(tempChildId);
    let reuse = "";
    try { await linkChildPhone(phoneCode); } catch (e) { reuse = (e as Error).message; }
    expect(reuse).not.toBe("");
    recordActual(MODULE, "INT-008", `Entering the code linked the phone to "${(state.context as any).childName ?? (state.context as any).child_name}"; the same code used again was refused ("${reuse}").`);
  })();
    jest.clearAllMocks();
  }, 900_000);
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
});
