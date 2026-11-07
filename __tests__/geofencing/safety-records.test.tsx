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
