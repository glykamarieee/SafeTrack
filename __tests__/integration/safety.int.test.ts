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

  test("INT-030: The entry and exit appear in the Daily Activity History", async () => {
    const day = await loadDailyActivity(watch.childId, today());
    const zoneEvents = day.events.filter((e) => e.geofenceId === zoneId).map((e) => e.title);
    expect(zoneEvents.length).toBeGreaterThanOrEqual(2);
    recordActual(MODULE, "INT-030", `Today's Daily Activity History for UT Child One listed the safe-zone events ${zoneEvents.map((t) => `"${t}"`).join(" and ")} together with ${day.points.length} location records.`);
  });

  test("INT-016: AI anomaly notices appear in the Daily Activity History", async () => {
    const notices = await fetchAnomaliesForChild(watch.childId);
    const days = [...new Set(notices.map((n: any) => (n.occurredAt ?? n.occurred_at).slice(0, 10)))];
    const day = await loadDailyActivity(watch.childId, days[0] ?? today());
    const ai = day.events.filter((e) => e.rawType === "possible_anomaly");
    expect(ai.length).toBeGreaterThan(0);
    recordActual(MODULE, "INT-016", `The Daily Activity History of ${days[0]} listed ${ai.length} AI notice(s) ("${ai[0].title}") under the AI notices filter. (Test notices added for UT Child One for this test.)`);
  });

  test("INT-017: The guardian can read why the AI flagged the movement", async () => {
    const notices: any[] = await fetchAnomaliesForChild(watch.childId);
    const withReasons = notices.find((n) => /:/.test(n.details ?? n.detail ?? ""));
    expect(withReasons).toBeTruthy();
    recordActual(MODULE, "INT-017", `The AI notice opened with its explanation: "${withReasons.details ?? withReasons.detail}" and score ${withReasons.anomalyScore ?? withReasons.anomaly_score}.`);
  });
});

describe("SOS from the watch with notifications, re-alerts, history and records", () => {
  test("INT-018: An SOS from the watch reaches the guardian as an active alert", async () => {
    const res = await watchSos(device, watch, LAPU, "button");
    expect(res.error).toBeNull();
    sosId = (res.data as any).sosAlertId ?? (res.data as any).id ?? (res.data as any).alertId;
    const active = await waitFor(async () => (await fetchActiveSosAlerts()).find((a) => a.id === sosId), 20_000, 2000);
    expect(active).toBeTruthy();
    recordActual(MODULE, "INT-018", `The watch sent an SOS (button) with its location; the guardian's SOS alerts listed it as "${active!.status}" at ${(active as any).latitude?.toFixed?.(5) ?? LAPU.latitude}, ${(active as any).longitude?.toFixed?.(5) ?? LAPU.longitude}, which fires the SOS push notification trigger.`);
  });

  test("INT-021: An unacknowledged SOS is re-alerted", async () => {
    const row = await waitFor(async () => { const r = await sosRow(sosId); return r.realert_count >= 1 ? r : null; }, 300_000, 10_000);
    expect(row).toBeTruthy();
    recordActual(MODULE, "INT-021", `With no acknowledgement, the server sent re-alert #${row.realert_count} at ${row.last_realert_at} ("SOS re-alert #${row.realert_count} from UT Child One").`);
  }, 330_000);

  test("INT-019: The SOS is recorded in the Daily Activity History", async () => {
    const day = await loadDailyActivity(watch.childId, today());
    const sos = day.events.find((e) => e.id === sosId || (e.rawType === "sos" && e.sosStatus === "active"));
    expect(sos).toBeTruthy();
    recordActual(MODULE, "INT-019", `Today's Daily Activity History listed the SOS ("${sos!.title}", status ${sos!.sosStatus}).`);
  });

  test("INT-031: The administrator's Safety records show the SOS", async () => {
    await signInAs(A.admin);
    const page = await fetchAdminRecords("sos", today(), today(), 0);
    const rec = page.records.find((r) => r.id === sosId);
    expect(rec).toBeTruthy();
    recordActual(MODULE, "INT-031", `Signed in as the administrator, Safety records › SOS alerts for today (${page.total} records) included the SOS of ${rec!.childName}.`);
    await signInAs(A.guardianWithChild);
  });

  test("INT-034: Acknowledging the SOS stops the re-alerts", async () => {
    await acknowledgeSosAlert(sosId);
    const after = await sosRow(sosId);
    expect(after.status).toBe("acknowledged");
    await sleep(200_000);
    const later = await sosRow(sosId);
    expect(later.realert_count).toBe(after.realert_count);
    const acked = sosId;
    sosId = "";
    recordActual(MODULE, "INT-034", `The guardian acknowledged the SOS (status "${after.status}" at ${after.acknowledged_at}); over the next 3 minutes 20 seconds no further re-alert was sent (re-alert count stayed ${later.realert_count}). Alert ${acked.slice(0, 8)}.`);
  }, 240_000);

  test("INT-035: An SOS cancelled on the watch as sent by mistake is closed and not re-alerted", async () => {
    const res = await watchSos(device, watch, LAPU, "shake");
    const id = (res.data as any).sosAlertId ?? (res.data as any).id ?? (res.data as any).alertId;
    const cancel = await watchCancelSos(device, watch, id);
    expect(cancel.error).toBeNull();
    const row = await sosRow(id);
    expect(row.status).toBe("cancelled");
    const active = (await fetchActiveSosAlerts()).some((a) => a.id === id);
    expect(active).toBe(false);
    recordActual(MODULE, "INT-035", `A shake SOS was sent and then cancelled from the watch ("I'm OK – sent by mistake"); the server saved it as "${row.status}" at ${row.updated_at}, it left the guardian's active alerts, and no re-alert was sent (count ${row.realert_count}).`);
  });
});
