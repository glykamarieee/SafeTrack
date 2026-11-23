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
});
