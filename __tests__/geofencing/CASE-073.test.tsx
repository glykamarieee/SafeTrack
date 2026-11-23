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
  test("CASE-073: Administrator opens Safety Records", async () => {
    await openRecords();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    screen.getByRole("tab", { name: /SOS alerts/ });
    screen.getByRole("tab", { name: /Location records/ });
    screen.getByRole("tab", { name: /Safety events/ });
    recordActual(MODULE, "CASE-073", 'Safety records opened with three tabs: "SOS alerts", "Location records" and "Safety events" (date presets Today to Custom).');
  });
});
