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

describe("View Safety Records when signed out", () => {

  beforeAll(signOutLocally);
  test("CASE-076: Signed-out user attempts to open Safety Records", async () => {
    useAuthStore.setState({ session: null, isBootstrapped: true, isLoading: false });
    await render(<AppLayout />);
    expect(Redirect).toHaveBeenCalledWith(expect.objectContaining({ href: "/(auth)/welcome" }), undefined);
    expect(screen.queryByText("Safety records")).toBeNull();

    // The server gives a signed-out visitor nothing either.
    const result = await fetchAdminRecords("safety", moveDate(todayKey(), -29), todayKey(), 0);
    expect(result.records).toHaveLength(0);
    recordActual(
      MODULE,
      "CASE-076",
      "Signed out, the app redirected to the Welcome screen instead of opening Safety records, and the server returned no records (0).",
    );
  });
});
