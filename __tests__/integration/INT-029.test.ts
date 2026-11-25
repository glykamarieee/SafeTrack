/**
 * Integration testing: Daily Activity History -> Tap-and-Shake SOS (live backend).
 * The latest stored SOS alert of the test guardian's children is found, and that day's
 * Daily Activity History must list it with its status (SOS filter).
 */
import { loadDailyActivity } from "../../services/activityHistoryService";
import { supabase } from "../../lib/supabase";
import { recordActual } from "../setup/record";
import { signInAs, signOutLocally } from "../setup/session";
import { accounts } from "../setup/accounts";
import { useAuthStore } from "../../store/authStore";
import { MODULE } from "./helpers";

const A = accounts as any;
afterAll(signOutLocally);

describe("SOS records in the Daily Activity History", () => {
  test("INT-029: The SOS history with each alert's status is displayed", async () => {
    await signInAs(A.guardianWithChild);
    const ids = useAuthStore.getState().linkedChildren.map((c) => c.id);
    const { data } = await supabase.from("sos_alerts").select("id, child_id, status, triggered_at").in("child_id", ids).order("triggered_at", { ascending: false }).limit(1);
    const sos = data![0] as any;
    const day = new Date(sos.triggered_at).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const activity = await loadDailyActivity(sos.child_id, day);
    const listed = activity.events.filter((e) => e.type === "sos");
    const it = listed.find((e) => e.id === sos.id)!;
    expect(it).toBeTruthy();
    expect(it.sosStatus).toBe(sos.status);
    recordActual(MODULE, "INT-029", `The history for ${day} listed ${listed.length} SOS record(s); the latest is "${it.title}" with status "${it.sosStatus}" (${it.detail}).`);
  });
});
