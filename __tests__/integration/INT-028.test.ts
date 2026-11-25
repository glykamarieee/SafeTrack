/**
 * Integration testing: Daily Activity History -> Smartwatch and Mobile Location Tracking (live backend).
 * For the test children, the most recent day with a stop (5 minutes or more within 60 m) is loaded
 * as the History screen loads it: its location records and stops are returned.
 */
import { estimateStops, loadActivityDays, loadDailyActivity } from "../../services/activityHistoryService";
import { philippineTodayKey } from "../../services/adminRecordsService";
import { recordActual } from "../setup/record";
import { signInAs, signOutLocally } from "../setup/session";
import { accounts } from "../setup/accounts";
import { useAuthStore } from "../../store/authStore";
import { MODULE } from "./helpers";

const A = accounts as any;
afterAll(signOutLocally);
const keyOf = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

describe("Location history in the Daily Activity History", () => {
  test("INT-028: The day's stops and location records are displayed", async () => {
    await signInAs(A.guardianWithChild);
    const today = philippineTodayKey();
    const from = keyOf(new Date(Date.now() - 30 * 86400000));
    let found: { name: string; day: string; points: number; stops: number } | null = null;
    for (const child of useAuthStore.getState().linkedChildren) {
      const days: any = await loadActivityDays(child.id, from, today);
      const keys = Object.keys(days.days).sort().reverse();
      for (const day of keys) {
        const activity = await loadDailyActivity(child.id, day);
        const stops = estimateStops(activity.points);
        if (activity.points.length && stops.length) { found = { name: child.fullName, day, points: activity.points.length, stops: stops.length }; break; }
      }
      if (found) break;
    }
    expect(found).toBeTruthy();
    recordActual(MODULE, "INT-028", `The Daily Activity History of ${found!.name} for ${found!.day} returned ${found!.points} location records and ${found!.stops} stop(s).`);
  }, 120_000);
});
