/**
 * Unit testing, AI Anomaly Detection & Geofencing Module: Receive and Review
 * Anomaly Notice (CASE-065 to CASE-069) and Review Explainable Anomaly Reason
 * (CASE-070 to CASE-072).
 *
 * The real Notifications and AI Safety Notices screens and the Supabase server
 * are used, signed in as the test guardian. UT Child One has real AI notices
 * (with and without listed reasons); UT Child Two has none.
 */
import { render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import AnomalyDetailsScreen from "../../app/(app)/anomaly-details";
import NotificationsScreen from "../../app/(app)/notifications";
import { selectChild } from "../../hooks/useSelectedChild";
import { supabase } from "../../lib/supabase";
import { useAnomalyStore } from "../../store/anomalyStore";
import { useAuthStore } from "../../store/authStore";
import { accounts } from "../setup/accounts";
import { recordActual } from "../setup/record";
import { signInAs, signOutLocally } from "../setup/session";

const MODULE = "geofencing";
const user = userEvent.setup();

type Notice = { id: string; title: string; details: string | null; latitude: number | null; longitude: number | null; anomaly_score: number | null; occurred_at: string };

let notices: Notice[] = [];

// Written as the screen writes them.
const reasonsOf = (details: string | null) => details?.match(/:\s*(.+?)\.\s*(Advisory only\.?)?$/)?.[1]?.split(/,\s*/).filter(Boolean) ?? [];
const timeOf = (value: string) =>
  new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function childNamed(name: string) {
  const child = useAuthStore.getState().linkedChildren.find((item) => item.fullName === name);
  if (!child) throw new Error(`${name} is not linked to the test guardian.`);
  return child.id;
}

async function openNotices(childName = "UT Child One") {
  selectChild(childNamed(childName));
  useAnomalyStore.setState({ anomalies: [], latestAnomaly: null, error: null, isLoading: false });
  await render(<AnomalyDetailsScreen />);
  await waitFor(
    () => {
      const { error } = useAnomalyStore.getState();
      if (error) throw new Error(`AI notices did not load: ${error}`);
      expect(screen.queryAllByText(/^(No AI notices|Why it was flagged)$/).length).toBeGreaterThan(0);
    },
    { timeout: 20000 },
  );
}

beforeAll(async () => {
  await signInAs(accounts.guardianWithChild);
  const { data, error } = await supabase
    .from("geofence_events")
    .select("id, title, details, latitude, longitude, anomaly_score, occurred_at")
    .eq("child_id", childNamed("UT Child One"))
    .eq("event_type", "possible_anomaly")
    .order("occurred_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  notices = (data ?? []) as Notice[];
  if (notices.length < 2) throw new Error("UT Child One needs at least two AI notices for these cases.");
});

afterAll(signOutLocally);

describe("Receive and Review Anomaly Notice", () => {

  test("CASE-068: Guardian opens the screen when no notices exist", async () => {
    await openNotices("UT Child Two");
    screen.getByText("No AI notices");
    screen.getByText("Nothing unusual has been flagged for this child.");
    recordActual(MODULE, "CASE-068", 'For a child with no notices the screen showed "No AI notices – Nothing unusual has been flagged for this child."');
  });
});
