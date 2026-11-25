/**
 * Integration testing: Smartwatch and Mobile Location Tracking -> Daily Activity History (live backend).
 * UT Child One's test watch (ST-WATCH-NFEGJ9K6) sends a location through the same database
 * function as the Wear OS app; the guardian's Daily Activity History for today must list it.
 */
import { loadDailyActivity } from "../../services/activityHistoryService";
import { philippineTodayKey } from "../../services/adminRecordsService";
import { generateWatchConnectionCode } from "../../services/watchPairingService";
import { recordActual } from "../setup/record";
import { signInAs, signOutLocally } from "../setup/session";
import { accounts } from "../setup/accounts";
import { useAuthStore } from "../../store/authStore";
import { deviceClient, LAPU_NORTH, MODULE, pairWatch, watchLocation } from "./helpers";

const A = accounts as any;
afterAll(signOutLocally);

describe("Location records stored for the Daily Activity History", () => {
  test("INT-011: A location sent by the watch is stored and listed in today's history", async () => {
    await signInAs(A.guardianWithChild);
    const device = deviceClient();
    const code = await generateWatchConnectionCode({ watchId: "ST-WATCH-NFEGJ9K6" });
    const watch = await pairWatch(device, "ST-WATCH-NFEGJ9K6", code.connectionCode);
    const before = Date.now();
    const sent = await watchLocation(device, watch, LAPU_NORTH);
    expect(sent.error).toBeNull();
    const day = await loadDailyActivity(watch.childId, philippineTodayKey());
    const stored = day.points.find((p: any) => Date.parse(p.recordedAt) >= before - 2000 && Math.abs(p.latitude - LAPU_NORTH.latitude) < 1e-4);
    expect(stored).toBeTruthy();
    expect(day.problems).toEqual([]);
    recordActual(MODULE, "INT-011", `The watch sent ${LAPU_NORTH.latitude}, ${LAPU_NORTH.longitude}; today's Daily Activity History of ${code.childName} listed it among ${day.points.length} location records (recorded ${(stored as any).recordedAt}).`);
  });
});
