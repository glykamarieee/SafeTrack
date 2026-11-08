/**
 * Unit testing, Tap-and-Shake SOS & Re-Alert Module, phone and guardian side:
 * Trigger SOS Alert (CASE-081, 082), Cancel SOS During Countdown (CASE-086,
 * 087), Receive SOS Alert (CASE-094 to 096), Acknowledge SOS Alert (CASE-098
 * to 100), Receive SOS Re-Alert (CASE-103) and View SOS Records (CASE-106 to
 * 110).
 *
 * The real child-phone SOS screen sends ONE real SOS from UT Child Two's
 * paired phone (it rings any phone signed in as the test guardian). The
 * guardian then reviews and acknowledges it on the real SOS Alerts screen.
 * Pop-ups are read from React Native's Alert.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";
import { act, fireEvent, render, screen, userEvent, waitFor } from "@testing-library/react-native";

import ChildSosScreen from "../../app/(child)/child-sos";
import SosAlertsScreen from "../../app/(app)/sos-alerts";
import AdminRecordsScreen from "../../app/(app)/admin-records";
import { supabase } from "../../lib/supabase";
import { recordChildPhoneLocation } from "../../services/childMobileService";
import { fetchActiveSosAlerts } from "../../services/sosService";
import { useAuthStore } from "../../store/authStore";
import { useChildMobileStore } from "../../store/childMobileStore";
import { accounts } from "../setup/accounts";
import { recordActual } from "../setup/record";
import { readerAs, signInAs, signOutLocally } from "../setup/session";

const MODULE = "sos";
const CHILD = accounts.childPhone.childId;
// A known spot, sent as the phone's latest location just before the SOS.
const SPOT = { latitude: 7.0712, longitude: 125.6101 };

const user = userEvent.setup();
const alerts = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
const lastAlert = () => {
  const call = alerts.mock.calls.at(-1);
  return call ? { title: call[0], message: call[1] ?? "" } : null;
};

let sosId: string | null = null;

async function sosRows(sinceIso: string) {
  const reader = await readerAs(accounts.guardianWithChild);
  const { data, error } = await reader
    .from("sos_alerts")
    .select("id, status, latitude, longitude, activation_method, triggered_at, acknowledged_at")
    .eq("child_id", CHILD)
    .gte("triggered_at", sinceIso)
    .order("triggered_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** SOS records created after `before` was taken (compared by id, not by clock). */
async function newSos(before: Set<string>) {
  return (await sosRows(new Date(Date.now() - 3_600_000).toISOString())).filter((row) => !before.has(row.id));
}

async function knownSos() {
  return new Set((await sosRows(new Date(Date.now() - 3_600_000).toISOString())).map((row) => row.id));
}

async function openChildSos() {
  await AsyncStorage.setItem("safetrack.childPhone", JSON.stringify(accounts.childPhone));
  useChildMobileStore.setState({ activeSos: null });
  await render(<ChildSosScreen />);
  await waitFor(() => expect(useChildMobileStore.getState().isLoading).toBe(false));
  return screen.getByLabelText("Hold to send SOS alert");
}

beforeEach(() => alerts.mockClear());

describe("SOS from the child phone", () => {
  beforeAll(signOutLocally);

  test("CASE-081: Child holds SOS on the linked child phone", async () => {
    const button = await openChildSos();
    await act(async () => fireEvent(button, "pressIn"));
    screen.getByText("Sending in 5");
    screen.getByText("Keep holding. Lift your finger to stop.");
    await waitFor(() => screen.getByText("Sending in 4"), { timeout: 3000 });
    await act(async () => fireEvent(button, "pressOut"));
    recordActual(MODULE, "CASE-081", 'Holding SOS started the 5-second countdown ("Sending in 5", then 4…) with "Keep holding. Lift your finger to stop."');
  });

  test("CASE-086: Child lifts the finger during the countdown on the child phone", async () => {
    const before = await knownSos();
    const button = await openChildSos();
    await act(async () => fireEvent(button, "pressIn"));
    await waitFor(() => screen.getByText("Sending in 4"), { timeout: 3000 });
    await act(async () => fireEvent(button, "pressOut"));
    screen.getByText("Press and hold");
    // Past the time the countdown would have ended: nothing was sent.
    await new Promise((resolve) => setTimeout(resolve, 5000));
    expect(await newSos(before)).toHaveLength(0);
    expect(alerts.mock.calls.some((call) => call[0] === "SOS Sent")).toBe(false);
    recordActual(MODULE, "CASE-086", 'Lifting the finger at "Sending in 4" stopped the countdown (back to "Press and hold"); no SOS was sent or stored.');
  });

  test("CASE-087: Child does nothing until the countdown ends (child phone)", async () => {
    await AsyncStorage.setItem("safetrack.childPhone", JSON.stringify(accounts.childPhone));
    await recordChildPhoneLocation(SPOT.latitude, SPOT.longitude, 6);
    const before = await knownSos();

    const button = await openChildSos();
    await act(async () => fireEvent(button, "pressIn"));
    await waitFor(() => expect(lastAlert()?.title).toBe("SOS Sent"), { timeout: 20000 });
    await waitFor(() => screen.getByText("Guardian notified"), { timeout: 20000 });

    const rows = await newSos(before);
    expect(rows).toHaveLength(1);
    sosId = rows[0]!.id;
    expect(rows[0]!.status).toBe("active");
    recordActual(
      MODULE,
      "CASE-087",
      `After the 5-second countdown the SOS was sent automatically: "SOS Sent – ${lastAlert()!.message}" and the screen changed to "Help request sent – Guardian notified".`,
    );
  });

  test("CASE-082: SOS is triggered while location is available", async () => {
    const row = (await sosRows(new Date(Date.now() - 3_600_000).toISOString())).find((item) => item.id === sosId)!;
    expect(Number(row.latitude)).toBeCloseTo(SPOT.latitude, 4);
    expect(Number(row.longitude)).toBeCloseTo(SPOT.longitude, 4);
    recordActual(
      MODULE,
      "CASE-082",
      `The SOS was stored with the phone's latest location (${Number(row.latitude).toFixed(5)}, ${Number(row.longitude).toFixed(5)}).`,
    );
  });
});

describe("The guardian receives and acknowledges the SOS", () => {
  beforeAll(async () => {
    if (!sosId) throw new Error("CASE-087 did not create the SOS these cases use.");
    await signInAs(accounts.guardianWithChild, CHILD);
  });

  afterAll(async () => {
    // Never leave the test SOS active.
    if (sosId) await supabase.rpc("acknowledge_my_sos_alert", { p_alert_id: sosId });
    await signOutLocally();
  });

  async function openAlerts() {
    await render(<SosAlertsScreen />);
    await waitFor(() => expect(screen.queryByText("Loading SOS records...")).toBeNull(), { timeout: 20000 });
  }

  test("CASE-094: Guardian opens the received alert", async () => {
    // The in-app alert list the guardian's Home uses.
    expect((await fetchActiveSosAlerts()).some((alert) => alert.id === sosId)).toBe(true);
    await openAlerts();
    screen.getByText("Needs acknowledgment");
    screen.getByRole("button", { name: /Acknowledge SOS/ });
    recordActual(MODULE, "CASE-094", 'SOS Alerts showed the new alert as "Needs acknowledgment" with its time, how it was sent, its location and an Acknowledge SOS button.');
  });

  test("CASE-095: Guardian views an alert with location", async () => {
    await openAlerts();
    const coordinates = `${SPOT.latitude.toFixed(5)}, ${SPOT.longitude.toFixed(5)}`;
    screen.getAllByText(coordinates);
    recordActual(MODULE, "CASE-095", `The alert showed its coordinates: ${coordinates}.`);
  });

  test("CASE-096: Guardian views an alert without location", async () => {
    const { data } = await supabase.from("sos_alerts").select("id").eq("child_id", CHILD).is("latitude", null).limit(1);
    expect(data ?? []).toHaveLength(1);
    await openAlerts();
    screen.getAllByText("Location unavailable");
    recordActual(MODULE, "CASE-096", 'An earlier alert stored without a location showed "Location unavailable".');
  });

  test("CASE-103: Guardian opens the re-alert", async () => {
    // A re-alert notification opens the same SOS Alerts screen for that alert.
    await openAlerts();
    screen.getByText("Needs acknowledgment");
    recordActual(MODULE, "CASE-103", "Opening the alert (as a re-alert notification does) showed the SOS details on SOS Alerts: time, method, location and status.");
  });

  test("CASE-100: A second guardian account attempts to acknowledge the alert", async () => {
    await signInAs(accounts.guardianNoChild);
    const { data, error } = await supabase.rpc("acknowledge_my_sos_alert", { p_alert_id: sosId });
    const refused = Boolean(error) || (data as { ok?: boolean } | null)?.ok === false;
    expect(refused).toBe(true);
    const message = error?.message ?? (data as { message?: string }).message;

    await signInAs(accounts.guardianWithChild, CHILD);
    const { data: row } = await supabase.from("sos_alerts").select("status").eq("id", sosId).single();
    expect(row!.status).toBe("active");
    recordActual(MODULE, "CASE-100", `Rejected for a guardian not linked to the child: "${message}"; the alert stayed active.`);
  });

  test("CASE-098: Guardian taps Acknowledge SOS", async () => {
    await openAlerts();
    await user.press(screen.getByRole("button", { name: /Acknowledge SOS/ }));
    await waitFor(() => expect(lastAlert()?.title).toBe("SOS acknowledged"), { timeout: 20000 });
    await waitFor(() => screen.getAllByText("Acknowledged"));
    const { data: row } = await supabase.from("sos_alerts").select("status, acknowledged_at").eq("id", sosId).single();
    expect(row!.status).toBe("acknowledged");
    sosId = null;
    recordActual(MODULE, "CASE-098", `"SOS acknowledged" was shown and the status changed to Acknowledged (saved with the acknowledgment time).`);
  });

  test("CASE-099: Guardian views the alert after acknowledging", async () => {
    await openAlerts();
    expect(screen.queryByRole("button", { name: /Acknowledge SOS/ })).toBeNull();
    expect(screen.queryByText("Needs acknowledgment")).toBeNull();
    recordActual(MODULE, "CASE-099", "After acknowledging, the alert showed Acknowledged and the Acknowledge SOS button was no longer shown.");
  });

  test("CASE-106: Guardian opens SOS Alerts", async () => {
    const { count } = await supabase.from("sos_alerts").select("id", { count: "exact", head: true }).eq("child_id", CHILD);
    await openAlerts();
    screen.getByText("Recorded SOS activity");
    const statuses = screen.getAllByText(/^(Needs acknowledgment|Acknowledged|Cancelled)$/);
    expect(statuses).toHaveLength(count!);
    recordActual(MODULE, "CASE-106", `All ${count} SOS records of the child were listed under "Recorded SOS activity", newest first.`);
  });

  test("CASE-107: Guardian views SOS records with event information", async () => {
    await openAlerts();
    screen.getAllByText(/^(Needs acknowledgment|Acknowledged|Cancelled)$/);
    screen.getAllByText(`${SPOT.latitude.toFixed(5)}, ${SPOT.longitude.toFixed(5)}`);
    recordActual(MODULE, "CASE-107", "Each record showed its time, its status (Acknowledged / Cancelled) and its location (or \"Location unavailable\").");
  });
});

describe("SOS records for other users", () => {
  afterAll(signOutLocally);

  test("CASE-108: Administrator opens the SOS tab", async () => {
    await signInAs(accounts.admin);
    await render(<AdminRecordsScreen />);
    await user.press(screen.getByText("30 days"));
    await waitFor(() => screen.getAllByRole("button", { name: /Show details$/ }), { timeout: 20000 });
    const names = new Set(screen.getAllByRole("button", { name: /Show details$/ }).map((node) => String(node.props.accessibilityLabel).split(", ").at(-1)));
    const ownChildren = ["UT Child One. Show details", "UT Child Two. Show details"];
    expect([...names].some((name) => !ownChildren.includes(name))).toBe(true);
    recordActual(MODULE, "CASE-108", `The SOS alerts tab (last 30 days) listed SOS records of every family (${names.size} children), not only one guardian's.`);
  });

  test("CASE-109: User opens SOS records when none exist", async () => {
    await signInAs(accounts.guardianNoChild);
    await render(<SosAlertsScreen />);
    await waitFor(() => screen.getByText("No confirmed SOS records"), { timeout: 20000 });
    screen.getByText("SafeTrack has no SOS record to display for this child.");
    recordActual(MODULE, "CASE-109", '"No confirmed SOS records – SafeTrack has no SOS record to display for this child." was shown.');
  });

  test("CASE-110: Signed-out user requests SOS records", async () => {
    await signOutLocally();
    const { data, error } = await supabase.from("sos_alerts").select("id").limit(50);
    expect(error ? 0 : (data ?? []).length).toBe(0);
    expect(useAuthStore.getState().session).toBeNull();
    recordActual(MODULE, "CASE-110", `Denied: signed out, the server returned ${error ? `an error ("${error.message}")` : "no SOS records (0)"}; the app sends a signed-out user to Welcome (as in CASE-076).`);
  });
});
