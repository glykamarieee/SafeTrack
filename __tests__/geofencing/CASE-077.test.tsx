/**
 * Unit testing, AI Anomaly Detection & Geofencing Module: View Safety Records
 * (CASE-073 to CASE-077).
 *
 * The real administrator Safety Records screen, the signed-in app layout and
 * the Supabase server are used, with the administrator, a signed-out visitor
 * and the test guardian.
 */
import { render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { Redirect } from "expo-router";

import AppLayout from "../../app/(app)/_layout";
import AdminRecordsScreen from "../../app/(app)/admin-records";
import { moveDate, todayKey } from "../../components/history/dates";
import { supabase } from "../../lib/supabase";
import { fetchAdminRecords } from "../../services/adminRecordsService";
import { useAuthStore } from "../../store/authStore";
import { accounts } from "../setup/accounts";
import { recordActual } from "../setup/record";
import { signInAs, signOutLocally } from "../setup/session";

const MODULE = "geofencing";
const user = userEvent.setup();

const EVENT_LABELS = {
  "Entered zone": "geofence entry",
  "Left zone": "geofence exit",
  "AI notice · advisory": "AI anomaly notice",
  "Watch offline": "device (watch offline)",
  Inactivity: "prolonged inactivity",
} as const;

async function openRecords() {
  await render(<AdminRecordsScreen />);
  await waitFor(() => screen.getByText(/· Philippine time ·/), { timeout: 20000 });
}

describe("Safety records requested by a guardian", () => {

  beforeAll(async () => {
    await signInAs(accounts.guardianWithChild);
  });
  afterAll(signOutLocally);
  test("CASE-077: Guardian account requests all safety records", async () => {
    const own = new Set(useAuthStore.getState().linkedChildren.map((child) => child.id));
    const { data, error } = await supabase.from("geofence_events").select("child_id").limit(5000);
    if (error) throw error;
    const children = new Set((data ?? []).map((row) => row.child_id));
    expect(data!.length).toBeGreaterThan(0);
    expect([...children].every((id) => own.has(id))).toBe(true);

    const page = await fetchAdminRecords("safety", moveDate(todayKey(), -29), todayKey(), 0);
    const names = new Set(page.records.map((record) => record.childName));
    const ownNames = new Set(useAuthStore.getState().linkedChildren.map((child) => child.fullName));
    expect([...names].every((name) => ownNames.has(name))).toBe(true);
    recordActual(
      MODULE,
      "CASE-077",
      `Asking for every safety record returned ${data!.length} rows, all for the guardian's own ${own.size} children (${[...ownNames].join(", ")}); no other family's records were returned.`,
    );
  });
});
