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




describe("SOS records for other users", () => {



  afterAll(signOutLocally);
  test("CASE-109: User opens SOS records when none exist", async () => {
    await signInAs(accounts.guardianNoChild);
    await render(<SosAlertsScreen />);
    await waitFor(() => screen.getByText("No confirmed SOS records"), { timeout: 20000 });
    screen.getByText("SafeTrack has no SOS record to display for this child.");
    recordActual(MODULE, "CASE-109", '"No confirmed SOS records – SafeTrack has no SOS record to display for this child." was shown.');
  });
});
