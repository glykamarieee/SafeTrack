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




describe("Fixes after the first integration run (11/16/2026)", () => {
  const device = deviceClient();


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
