/**
 * Unit testing, AI Anomaly Detection & Geofencing Module:
 * Create Safe Zone (CASE-038 to CASE-047) and Edit or Delete Safe Zone
 * (CASE-048 to CASE-054).
 *
 * The real Safe Zones screen, geofence store and Supabase server are used,
 * signed in as the test guardian, on the guardian's second child (UT Child
 * Two). The map itself needs a phone's map engine, so a stand-in records what
 * the screen asks it to draw and lets the test tap a point on it. Pop-ups are
 * read from React Native's Alert, and their buttons pressed, as on the phone.
 * Every zone made here is named "UT Zone …" and deleted at the end.
 */
import { Alert } from "react-native";
import { act, render, screen, userEvent, waitFor } from "@testing-library/react-native";

import SafeZonesScreen from "../../app/(app)/safe-zones";
import { supabase } from "../../lib/supabase";
import * as locationService from "../../services/locationService";
import { useGeofenceStore } from "../../store/geofenceStore";
import { accounts } from "../setup/accounts";
import { recordActual } from "../setup/record";
import { signInAs, signOutLocally } from "../setup/session";

jest.mock("../../components/location/SafeTrackInteractiveMap", () => {
  const map: { props: any } = { props: null };
  return {
    __map: map,
    SafeTrackInteractiveMap: (props: any) => {
      map.props = props;
      return null;
    },
  };
});

const map = (jest.requireMock("../../components/location/SafeTrackInteractiveMap") as { __map: { props: any } }).__map;

const MODULE = "geofencing";
const CHILD = accounts.childPhone.childId;
const TAG = String(Date.now()).slice(-5);
const ZONE_A = `UT Zone Home ${TAG}`;
const ZONE_A2 = `UT Zone House ${TAG}`;
const ZONE_B = `UT Zone School ${TAG}`;
const HELP = /Add a name, choose a Safe Zone center, and use a radius from 30 to 5000 meters\./;

const user = userEvent.setup();
const alerts = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);

function lastAlert() {
  const call = alerts.mock.calls.at(-1);
  if (!call) throw new Error("No pop-up was shown.");
  return { title: call[0], message: call[1] ?? "", buttons: (call[2] ?? []) as { text: string; onPress?: () => unknown }[] };
}

async function zoneRows() {
  const { data, error } = await supabase
    .from("geofences")
    .select("id, name, latitude, longitude, radius_meters, is_enabled")
    .eq("child_id", CHILD)
    .like("name", "UT Zone%");
  if (error) throw error;
  return data ?? [];
}

async function zoneNamed(name: string) {
  return (await zoneRows()).find((row) => row.name === name) ?? null;
}

async function openScreen() {
  await render(<SafeZonesScreen />);
  await waitFor(() => expect(screen.queryByText("Loading Safe Zones…")).toBeNull(), { timeout: 20000 });
}

async function openNewZone() {
  await openScreen();
  await user.press(screen.getByText("Add zone"));
  await waitFor(() => screen.getByText("NEW SAFE ZONE"));
}

const nameField = () => screen.getByPlaceholderText("Home, School, Relative's House");

async function setName(value: string) {
  await user.clear(nameField());
  if (value) await user.type(nameField(), value);
}

async function setRadius(from: string, to: string) {
  const field = screen.getByDisplayValue(from);
  await user.clear(field);
  await user.type(field, to);
}

/** Pick on SafeTrack map, then tap the point (as the guardian taps the map). */
async function pickOnMap(latitude: number, longitude: number) {
  await user.press(screen.getByText("Pick on SafeTrack map"));
  await waitFor(() => screen.getByText("Set the Safe Zone center"));
  await act(async () => map.props.onMapPress({ latitude, longitude }));
  await waitFor(() => screen.getByText("Selected on the SafeTrack map"));
}

/** The Edit / Disable / Delete links of one saved zone, in list order. */
function zoneIndex(name: string) {
  const index = useGeofenceStore.getState().zones.findIndex((zone) => zone.name === name);
  if (index < 0) throw new Error(`${name} is not in the list.`);
  return index;
}

async function pressRowAction(name: string, label: RegExp) {
  await user.press(screen.getAllByText(label)[zoneIndex(name)]!);
}

beforeEach(() => alerts.mockClear());

describe("Safe Zones of a registered child", () => {

  beforeAll(async () => {
    await signInAs(accounts.guardianWithChild, CHILD);
  });
  afterAll(async () => {
    for (const row of await zoneRows()) {
      await supabase.from("geofences").delete().eq("id", row.id);
    }
  });
  test("CASE-043: Guardian uses the child's latest location as the center", async () => {
    const { data } = await supabase
      .from("location_logs")
      .select("latitude, longitude")
      .eq("child_id", CHILD)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .single();
    const expected = `${Number(data!.latitude).toFixed(6)}, ${Number(data!.longitude).toFixed(6)}`;

    await openNewZone();
    await user.press(screen.getByText("Use child's latest location"));
    await waitFor(() => screen.getByText("Using child's latest available location"));
    // Once in the child's location card, once as the form's center.
    expect(screen.getAllByText(expected)).toHaveLength(2);
    recordActual(
      MODULE,
      "CASE-043",
      `The center was set to the child's latest stored location (${expected}), labelled "Using child's latest available location".`,
    );
  });
});
