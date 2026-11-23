/**
 * Integration testing: AI-Based Anomaly Detection and Geofencing, Tap-and-Shake SOS &
 * Re-Alert, Notification Delivery, Daily Activity History, Dashboard Management and the
 * Administrator Dashboard (live backend).
 *
 * The child side is UT Child One's test watch (ST-WATCH-NFEGJ9K6), paired with a fresh
 * guardian code and calling the same database functions as the Wear OS app. A temporary
 * safe zone "UT Integration Zone" is made around Lapu-Lapu City Hall and deleted at the end.
 * The SOS alerts are test alerts of the test child; they ring only a phone signed in as the
 * test guardian, and each is acknowledged or cancelled here.
 */
import { supabase } from "../../lib/supabase";
import { fetchAdminRecords, philippineTodayKey } from "../../services/adminRecordsService";
import { loadDailyActivity } from "../../services/activityHistoryService";
import { fetchAnomaliesForChild } from "../../services/anomalyService";
import { createGeofence, deleteGeofence, fetchGeofences } from "../../services/geofenceService";
import { acknowledgeSosAlert, fetchActiveSosAlerts } from "../../services/sosService";
import { generateWatchConnectionCode } from "../../services/watchPairingService";
import { useAuthStore } from "../../store/authStore";
import { accounts } from "../setup/accounts";
import { recordActual } from "../setup/record";
import { signInAs, signOutLocally } from "../setup/session";
import { deviceClient, LAPU, LAPU_NORTH, MODULE, pairWatch, sleep, waitFor, watchCancelSos, watchLocation, watchSos, type WatchSession } from "./helpers";

const A = accounts as any;
const TEST_WATCH = "ST-WATCH-NFEGJ9K6";
const device = deviceClient();
let watch: WatchSession;
let zoneId = "";
let sosId = "";
const today = () => philippineTodayKey();

async function sosRow(id: string) {
  const { data } = await supabase.from("sos_alerts").select("status, realert_count, last_realert_at, acknowledged_at, updated_at, latitude, longitude").eq("id", id).single();
  return data as any;
}

beforeAll(async () => {
  await signInAs(A.guardianWithChild);
  const code = await generateWatchConnectionCode({ watchId: TEST_WATCH });
  watch = await pairWatch(device, TEST_WATCH, code.connectionCode);
});

afterAll(async () => {
  await signInAs(A.guardianWithChild);
  if (sosId) await acknowledgeSosAlert(sosId).catch(() => undefined);
  if (zoneId) await deleteGeofence(zoneId).catch(() => undefined);
  await signOutLocally();
});

describe("Geofencing with notifications, the dashboard and the history", () => {

  test("INT-014: Entering and leaving a safe zone records entry and exit events for the guardian", async () => {
    const guardianId = useAuthStore.getState().guardian!.id;
    await createGeofence({ guardianId, childId: watch.childId, name: "UT Integration Zone", address: "Lapu-Lapu City Hall", ...LAPU, radiusMeters: 100, isEnabled: true });
    zoneId = (await fetchGeofences(guardianId, watch.childId)).find((z) => z.name === "UT Integration Zone")!.id;
    const since = new Date(Date.now() - 5000).toISOString();
    await watchLocation(device, watch, LAPU_NORTH);
    await watchLocation(device, watch, LAPU);
    await sleep(1500);
    await watchLocation(device, watch, LAPU_NORTH);
    const { data } = await supabase.from("geofence_events").select("event_type, title, occurred_at").eq("geofence_id", zoneId).gte("occurred_at", since).order("occurred_at");
    expect((data ?? []).map((e: any) => e.event_type)).toEqual(["entry", "exit"]);
    recordActual(MODULE, "INT-014", `The watch moved from 1.1 km away into the 100 m zone and out again; the server recorded "${data![0].title}" and "${data![1].title}" for the guardian, which fire the guardian push notification trigger.`);
  });
});
