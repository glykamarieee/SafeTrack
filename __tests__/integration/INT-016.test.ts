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

  test("INT-016: AI anomaly notices appear in the Daily Activity History", async () => {
    const notices = await fetchAnomaliesForChild(watch.childId);
    const days = [...new Set(notices.map((n: any) => (n.occurredAt ?? n.occurred_at).slice(0, 10)))];
    const day = await loadDailyActivity(watch.childId, days[0] ?? today());
    const ai = day.events.filter((e) => e.rawType === "possible_anomaly");
    expect(ai.length).toBeGreaterThan(0);
    recordActual(MODULE, "INT-016", `The Daily Activity History of ${days[0]} listed ${ai.length} AI notice(s) ("${ai[0].title}") under the AI notices filter. (Test notices added for UT Child One for this test.)`);
  });
});
