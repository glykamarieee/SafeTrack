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
import { selectChild } from "../../hooks/useSelectedChild";
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

describe("The guardian receives and acknowledges the SOS", () => {

  async function openAlerts() {
    await render(<SosAlertsScreen />);
    await waitFor(() => expect(screen.queryByText("Loading SOS records...")).toBeNull(), { timeout: 20000 });
  }

  // Setup: earlier cases this case builds on, run as steps (not counted as tests).
  beforeAll(async () => {
    await (async () => {

await (signOutLocally)();
await (async () => {
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
  })();
    await require("@testing-library/react-native").cleanup();
    jest.clearAllMocks();
    })();
  }, 900_000);
  beforeAll(async () => {
    if (!sosId) throw new Error("CASE-087 did not create the SOS these cases use.");
    await signInAs(accounts.guardianWithChild, CHILD);
  });
  afterAll(async () => {
    // Never leave the test SOS active.
    if (sosId) await supabase.rpc("acknowledge_my_sos_alert", { p_alert_id: sosId });
    await signOutLocally();
  });
  test("CASE-095: Guardian views an alert with location", async () => {
    await openAlerts();
    const coordinates = `${SPOT.latitude.toFixed(5)}, ${SPOT.longitude.toFixed(5)}`;
    screen.getAllByText(coordinates);
    recordActual(MODULE, "CASE-095", `The alert showed its coordinates: ${coordinates}.`);
  });
});
