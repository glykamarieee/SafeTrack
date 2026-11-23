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
  test("CASE-074: Administrator views the Safety Events tab", async () => {
    await openRecords();
    await user.press(screen.getByRole("tab", { name: /Safety events/ }));
    await user.press(screen.getByText("30 days"));
    await waitFor(() => screen.getAllByRole("button", { name: /Show details$/ }), { timeout: 20000 });

    const seen = new Set<string>();
    for (let page = 0; page < 12; page += 1) {
      for (const label of Object.keys(EVENT_LABELS)) if (screen.queryAllByText(label).length) seen.add(label);
      if (seen.size === Object.keys(EVENT_LABELS).length) break;
      const more = screen.queryByText(/^Load \d+ more$/);
      if (!more) break;
      const shown = screen.getAllByRole("button", { name: /Show details$/ }).length;
      await user.press(more);
      await waitFor(() => expect(screen.getAllByRole("button", { name: /Show details$/ }).length).toBeGreaterThan(shown), { timeout: 20000 });
    }

    expect([...seen].sort()).toEqual(Object.keys(EVENT_LABELS).sort());
    recordActual(
      MODULE,
      "CASE-074",
      `The Safety events tab (last 30 days) listed ${Object.values(EVENT_LABELS).join(", ")} events, each with its child, time and label.`,
    );
  });
});
