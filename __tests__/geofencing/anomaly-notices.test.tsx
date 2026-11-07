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
  test("CASE-065: Guardian opens an available anomaly notice", async () => {
    selectChild(childNamed("UT Child One"));
    await render(<NotificationsScreen />);
    const item = await waitFor(() => screen.getAllByText(notices[0]!.title)[0]!, { timeout: 20000 });
    await user.press(item);
    expect(router.navigate).toHaveBeenCalledWith("/(app)/anomaly-details");

    await openNotices();
    screen.getByText("AI safety notices");
    screen.getByText(timeOf(notices[0]!.occurred_at));
    recordActual(
      MODULE,
      "CASE-065",
      `Tapping "${notices[0]!.title}" in Notifications opened the AI safety notices screen with the notice details.`,
    );
  });

  test("CASE-066: Guardian views a notice with location and time information", async () => {
    const notice = notices.find((item) => item.latitude != null && item.longitude != null)!;
    await openNotices();
    const position = `Location: ${Number(notice.latitude).toFixed(5)}, ${Number(notice.longitude).toFixed(5)}`;
    const time = timeOf(notice.occurred_at);
    screen.getAllByText(position);
    screen.getAllByText(time);
    recordActual(
      MODULE,
      "CASE-066",
      `The notice showed "${position}" and the time "${time}" (Philippine time), matching the stored record.`,
    );
  });

  test("CASE-067: Guardian views multiple anomaly notices", async () => {
    await openNotices();
    expect(screen.getAllByText("Why it was flagged")).toHaveLength(notices.length);
    const times = screen.getAllByText(/^[A-Z][a-z]{2} \d{1,2}, \d{1,2}:\d{2}/).map((node) => String(node.props.children));
    expect(times).toEqual(notices.map((notice) => timeOf(notice.occurred_at)));
    recordActual(MODULE, "CASE-067", `All ${notices.length} stored notices were listed, newest first.`);
  });

  test("CASE-068: Guardian opens the screen when no notices exist", async () => {
    await openNotices("UT Child Two");
    screen.getByText("No AI notices");
    screen.getByText("Nothing unusual has been flagged for this child.");
    recordActual(MODULE, "CASE-068", 'For a child with no notices the screen showed "No AI notices – Nothing unusual has been flagged for this child."');
  });

  test("CASE-069: Guardian reads the notice wording", async () => {
    await openNotices();
    const note = screen.getByText(/Notices are advisory\./);
    const text = String([note.props.children].flat().join(""));
    expect(text).toMatch(/They are not emergencies; SOS alerts are separate\./);
    expect(screen.queryByText(/^(Active SOS|Emergency)/)).toBeNull();
    recordActual(
      MODULE,
      "CASE-069",
      `Notices are titled "${notices[0]!.title}" and the screen says: "${text.replace(/\s+/g, " ").trim()}"`,
    );
  });
});

describe("Review Explainable Anomaly Reason", () => {
  test("CASE-070: Guardian opens a notice with stored reasons", async () => {
    // The notice with the most reasons.
    const notice = [...notices].sort((x, y) => reasonsOf(y.details).length - reasonsOf(x.details).length)[0]!;
    expect(reasonsOf(notice.details).length).toBeGreaterThan(0);
    const reasons = reasonsOf(notice.details).map((reason) => reason.charAt(0).toUpperCase() + reason.slice(1));
    await openNotices();
    for (const reason of reasons) screen.getAllByText(reason);
    recordActual(MODULE, "CASE-070", `"Why it was flagged" listed each stored reason separately: ${reasons.map((reason) => `"${reason}"`).join(", ")}.`);
  });

  test("CASE-071: Guardian views the anomaly score", async () => {
    const notice = notices.find((item) => item.anomaly_score != null)!;
    const score = `Score ${Number(notice.anomaly_score).toFixed(2)}`;
    await openNotices();
    screen.getAllByText(score);
    recordActual(MODULE, "CASE-071", `The score was shown on the notice as "${score}".`);
  });

  test("CASE-072: Guardian opens a notice without separate reasons", async () => {
    const notice = notices.find((item) => reasonsOf(item.details).length === 0);
    if (!notice) throw new Error("UT Child One has no notice without listed reasons.");
    const general = notice.details ?? "Unusual compared with this child's usual pattern.";
    await openNotices();
    screen.getAllByText(general);
    recordActual(MODULE, "CASE-072", `A notice with no listed reasons showed the general explanation: "${general}"`);
  });
});
