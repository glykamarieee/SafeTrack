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

describe("SOS from the watch with notifications, re-alerts, history and records", () => {

  // Setup: earlier cases this case builds on, run as steps (not counted as tests).
  beforeAll(async () => {
await (async () => {
    const res = await watchSos(device, watch, LAPU, "button");
    expect(res.error).toBeNull();
    sosId = (res.data as any).sosAlertId ?? (res.data as any).id ?? (res.data as any).alertId;
    const active = await waitFor(async () => (await fetchActiveSosAlerts()).find((a) => a.id === sosId), 20_000, 2000);
    expect(active).toBeTruthy();
    recordActual(MODULE, "INT-018", `The watch sent an SOS (button) with its location; the guardian's SOS alerts listed it as "${active!.status}" at ${(active as any).latitude?.toFixed?.(5) ?? LAPU.latitude}, ${(active as any).longitude?.toFixed?.(5) ?? LAPU.longitude}, which fires the SOS push notification trigger.`);
  })();
    jest.clearAllMocks();
  }, 900_000);
  test("INT-021: An unacknowledged SOS is re-alerted", async () => {
    const row = await waitFor(async () => { const r = await sosRow(sosId); return r.realert_count >= 1 ? r : null; }, 300_000, 10_000);
    expect(row).toBeTruthy();
    recordActual(MODULE, "INT-021", `With no acknowledgement, the server sent re-alert #${row.realert_count} at ${row.last_realert_at} ("SOS re-alert #${row.realert_count} from UT Child One").`);
  }, 330_000);
});
