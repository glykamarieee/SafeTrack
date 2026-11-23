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




describe("View Safety Records as the administrator", () => {




  beforeAll(async () => {
    await signInAs(accounts.admin);
    expect(useAuthStore.getState().role).toBe("admin");
  });
  afterAll(signOutLocally);
  test("CASE-075: Administrator views a period with no records", async () => {
    await openRecords();
    await user.press(screen.getByRole("tab", { name: /Safety events/ }));
    await user.press(screen.getByText("Custom"));
    const today = todayKey();
    const from = screen.getByDisplayValue(moveDate(today, -6));
    const to = screen.getAllByDisplayValue(today).at(-1)!;
    await user.clear(from);
    await user.type(from, "2025-01-01");
    await user.clear(to);
    await user.type(to, "2025-01-07");
    await user.press(screen.getByText("Show"));
    const empty = await waitFor(() => screen.getByText("No records in this period"), { timeout: 20000 });
    recordActual(MODULE, "CASE-075", `For January 1–7, 2025 the screen showed "${empty.props.children}." (Try a longer range, or another tab.)`);
  });
});
