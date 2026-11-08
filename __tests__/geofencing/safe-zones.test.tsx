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

  test("CASE-038: Guardian opens the Create Safe Zone feature", async () => {
    await openNewZone();
    expect(map.props).not.toBeNull();
    screen.getByText("Choose a trusted place");
    screen.getByText("Use child's latest location");
    screen.getByText("Pick on SafeTrack map");
    screen.getByText("Create Safe Zone");
    recordActual(
      MODULE,
      "CASE-038",
      'The New Safe Zone form opened ("Choose a trusted place") with Name, Address, Safe-Zone Center (Use child\'s latest location / Pick on SafeTrack map) and Radius, above the SafeTrack map.',
    );
  });

  test("CASE-039: Guardian creates a safe zone with a valid name, center and radius", async () => {
    await openNewZone();
    await setName(ZONE_A);
    await pickOnMap(7.2, 125.5);
    await user.press(screen.getByText("100 m"));
    await user.press(screen.getByText("Create Safe Zone"));

    await waitFor(() => expect(alerts).toHaveBeenCalled(), { timeout: 20000 });
    const shown = lastAlert();
    expect(shown.title).toBe("Safe Zone created");
    await waitFor(() => screen.getByText(ZONE_A));
    const circle = map.props.circles.find((item: { label: string }) => item.label === ZONE_A);
    expect(circle).toMatchObject({ latitude: 7.2, longitude: 125.5, radiusMeters: 100 });
    const row = await zoneNamed(ZONE_A);
    expect(row).toMatchObject({ radius_meters: 100, is_enabled: true });
    recordActual(
      MODULE,
      "CASE-039",
      `"${shown.title}" was shown; the zone (100 m radius) was saved, listed as Active under Saved Safe Zones and drawn on the map.`,
    );
  });

  test("CASE-040: Guardian leaves the safe zone name empty", async () => {
    await openNewZone();
    await pickOnMap(7.21, 125.51);
    expect(screen.getByText("Create Safe Zone")).toBeDisabled();
    const help = screen.getByText(HELP);
    await user.press(screen.getByText("Create Safe Zone"));
    expect(alerts).not.toHaveBeenCalled();
    recordActual(
      MODULE,
      "CASE-040",
      `Create Safe Zone stayed disabled and the form showed "${help.props.children}"; nothing was saved.`,
    );
  });

  test("CASE-041: Guardian does not select a center on the map", async () => {
    await openNewZone();
    await setName(`UT Zone NoCenter ${TAG}`);
    screen.getByText("No location selected");
    const note = screen.getByText(/Choose the center before saving\./);
    expect(screen.getByText("Create Safe Zone")).toBeDisabled();
    screen.getByText(HELP);
    expect(await zoneNamed(`UT Zone NoCenter ${TAG}`)).toBeNull();
    recordActual(
      MODULE,
      "CASE-041",
      `Create Safe Zone stayed disabled; the center panel showed "No location selected" and "${note.props.children}"`,
    );
  });

  test("CASE-042: Guardian enters a radius below 30 or above 5000 meters", async () => {
    await openNewZone();
    await setName(`UT Zone Radius ${TAG}`);
    await pickOnMap(7.22, 125.52);
    await setRadius("200", "20");
    expect(screen.getByText("Create Safe Zone")).toBeDisabled();
    screen.getByText(HELP);
    await setRadius("20", "6000");
    expect(screen.getByText("Create Safe Zone")).toBeDisabled();
    screen.getByText(HELP);
    screen.getByText("30–5000 meters");
    expect(await zoneNamed(`UT Zone Radius ${TAG}`)).toBeNull();
    recordActual(
      MODULE,
      "CASE-042",
      'Radius 20 m and 6000 m were both refused: Create Safe Zone stayed disabled and the form showed the allowed range "30–5000 meters" and "use a radius from 30 to 5000 meters".',
    );
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

  test("CASE-044: Guardian uses the child's location when none exists yet", async () => {
    // A child with no location record yet: the latest-location lookup finds nothing.
    const none = jest.spyOn(locationService, "fetchLatestLocationForChild").mockResolvedValue(null);
    try {
      await openNewZone();
      await user.press(screen.getByText("Use child's latest location"));
      await waitFor(() => expect(alerts).toHaveBeenCalled());
      const shown = lastAlert();
      expect(shown.title).toBe("No child location available");
      screen.getByText("No location selected");
      recordActual(MODULE, "CASE-044", `"${shown.title}" was shown: "${shown.message}" The center stayed empty.`);
    } finally {
      none.mockRestore();
    }
  });

  test("CASE-045: Guardian cancels creation before saving", async () => {
    const name = `UT Zone Cancel ${TAG}`;
    await openNewZone();
    await setName(name);
    await pickOnMap(7.23, 125.53);
    await user.press(screen.getByLabelText("Close"));
    await waitFor(() => expect(screen.queryByText("NEW SAFE ZONE")).toBeNull());
    expect(screen.queryByText(name)).toBeNull();
    expect(await zoneNamed(name)).toBeNull();
    recordActual(MODULE, "CASE-045", "Close shut the form; the zone was not listed and no record was saved.");
  });

  test("CASE-046: Guardian creates multiple safe zones for one child", async () => {
    await openNewZone();
    await setName(ZONE_B);
    await pickOnMap(7.24, 125.54);
    await user.press(screen.getByText("Create Safe Zone"));
    await waitFor(() => expect(lastAlert().title).toBe("Safe Zone created"), { timeout: 20000 });
    await waitFor(() => screen.getByText(ZONE_B));
    screen.getByText(ZONE_A);
    const rows = (await zoneRows()).filter((row) => row.name.endsWith(TAG));
    expect(rows.map((row) => row.name).sort()).toEqual([ZONE_A, ZONE_B].sort());
    recordActual(MODULE, "CASE-046", `A second zone was created; both zones (${rows.length}) were saved and listed for the same child.`);
  });

  test("CASE-048: Guardian opens an existing safe zone", async () => {
    await openScreen();
    await pressRowAction(ZONE_A, /^Edit$/);
    await waitFor(() => screen.getByText("EDIT SAFE ZONE"));
    expect(nameField().props.value).toBe(ZONE_A);
    screen.getByDisplayValue("100");
    screen.getByText("Saved Safe Zone center");
    screen.getByText("7.200000, 125.500000");
    screen.getByText("Save changes");
    recordActual(
      MODULE,
      "CASE-048",
      "Edit Safe Zone opened with the saved name, center (7.200000, 125.500000, \"Saved Safe Zone center\") and 100 m radius.",
    );
  });

  test("CASE-049: Guardian updates the safe zone with valid values", async () => {
    await openScreen();
    await pressRowAction(ZONE_A, /^Edit$/);
    await waitFor(() => screen.getByText("EDIT SAFE ZONE"));
    await setName(ZONE_A2);
    await user.press(screen.getByText("Save changes"));
    await waitFor(() => expect(alerts).toHaveBeenCalled(), { timeout: 20000 });
    const shown = lastAlert();
    expect(shown.title).toBe("Safe Zone updated");
    await waitFor(() => screen.getByText(ZONE_A2));
    expect(await zoneNamed(ZONE_A2)).not.toBeNull();
    expect(await zoneNamed(ZONE_A)).toBeNull();
    recordActual(MODULE, "CASE-049", `"${shown.title}" was shown; the new name was saved and listed.`);
  });

  test("CASE-050: Guardian saves an edit with the name empty", async () => {
    await openScreen();
    await pressRowAction(ZONE_A2, /^Edit$/);
    await waitFor(() => screen.getByText("EDIT SAFE ZONE"));
    await setName("");
    expect(screen.getByText("Save changes")).toBeDisabled();
    const help = screen.getByText(HELP);
    await user.press(screen.getByText("Save changes"));
    expect(alerts).not.toHaveBeenCalled();
    expect(await zoneNamed(ZONE_A2)).not.toBeNull();
    recordActual(
      MODULE,
      "CASE-050",
      `Save changes stayed disabled and the form showed "${help.props.children}"; the saved name was kept.`,
    );
  });

  test("CASE-051: Guardian changes the center or radius", async () => {
    await openScreen();
    await pressRowAction(ZONE_A2, /^Edit$/);
    await waitFor(() => screen.getByText("EDIT SAFE ZONE"));
    await setRadius("100", "300");
    await pickOnMap(7.205, 125.505);
    await user.press(screen.getByText("Save changes"));
    await waitFor(() => expect(lastAlert().title).toBe("Safe Zone updated"), { timeout: 20000 });
    await waitFor(() => {
      const circle = map.props.circles.find((item: { label: string }) => item.label === ZONE_A2);
      expect(circle).toMatchObject({ latitude: 7.205, longitude: 125.505, radiusMeters: 300 });
    });
    const row = await zoneNamed(ZONE_A2);
    expect(row).toMatchObject({ radius_meters: 300 });
    expect(Number(row!.latitude)).toBeCloseTo(7.205, 6);
    recordActual(
      MODULE,
      "CASE-051",
      "The new center (7.205000, 125.505000) and 300 m radius were saved and the map circle moved and grew to match.",
    );
  });

  test("CASE-052: Guardian turns a safe zone off or on", async () => {
    await openScreen();
    await pressRowAction(ZONE_A2, /^(Disable|Enable)$/);
    await waitFor(async () => expect((await zoneNamed(ZONE_A2))!.is_enabled).toBe(false), { timeout: 15000 });
    await waitFor(() => expect(useGeofenceStore.getState().zones.find((zone) => zone.name === ZONE_A2)?.isEnabled).toBe(false));
    screen.getAllByText("Disabled");
    await pressRowAction(ZONE_A2, /^(Disable|Enable)$/);
    await waitFor(async () => expect((await zoneNamed(ZONE_A2))!.is_enabled).toBe(true), { timeout: 15000 });
    recordActual(MODULE, "CASE-052", 'Disable saved the zone as off (shown "Disabled"); Enable saved it as on again (shown "Active").');
  });

  test("CASE-054: Guardian cancels the edit or delete action", async () => {
    const before = await zoneNamed(ZONE_B);
    await openScreen();
    await pressRowAction(ZONE_B, /^Edit$/);
    await waitFor(() => screen.getByText("EDIT SAFE ZONE"));
    await setName(`UT Zone Changed ${TAG}`);
    await user.press(screen.getByLabelText("Close"));
    await waitFor(() => expect(screen.queryByText("EDIT SAFE ZONE")).toBeNull());

    await pressRowAction(ZONE_B, /^Delete$/);
    const shown = lastAlert();
    expect(shown.title).toBe("Delete Safe Zone?");
    const cancel = shown.buttons.find((button) => button.text === "Cancel");
    await act(async () => cancel?.onPress?.());

    expect(await zoneNamed(ZONE_B)).toEqual(before);
    screen.getByText(ZONE_B);
    recordActual(
      MODULE,
      "CASE-054",
      `Closing the edit without saving kept the old name; on "${shown.title}" Cancel kept the zone. Nothing was changed.`,
    );
  });

  test("CASE-053: Guardian deletes a safe zone and confirms", async () => {
    await openScreen();
    await pressRowAction(ZONE_B, /^Delete$/);
    const shown = lastAlert();
    expect(shown.title).toBe("Delete Safe Zone?");
    const remove = shown.buttons.find((button) => button.text === "Delete");
    await act(async () => {
      await remove?.onPress?.();
    });
    await waitFor(() => expect(screen.queryByText(ZONE_B)).toBeNull());
    expect(await zoneNamed(ZONE_B)).toBeNull();
    recordActual(MODULE, "CASE-053", `"${shown.title}" (${shown.message}) was confirmed with Delete; the zone was removed from the list and the database.`);
  });
});

describe("Safe Zones without a registered child", () => {
  beforeAll(async () => {
    await signInAs(accounts.guardianNoChild);
  });

  afterAll(signOutLocally);

  test("CASE-047: Guardian attempts to save a safe zone with no registered child", async () => {
    const name = `UT Zone NoChild ${TAG}`;
    await openNewZone();
    await setName(name);
    await pickOnMap(7.25, 125.55);
    await user.press(screen.getByText("Create Safe Zone"));
    await waitFor(() => expect(alerts).toHaveBeenCalled());
    const shown = lastAlert();
    expect(shown.title).toBe("Unable to save");
    const { data } = await supabase.from("geofences").select("id").eq("name", name);
    expect(data ?? []).toHaveLength(0);
    recordActual(MODULE, "CASE-047", `Saving was blocked: "${shown.title}" – "${shown.message}" Nothing was saved.`);
  });
});
