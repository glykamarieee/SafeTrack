// Still detection (2026-11-15): the watch's activity guess and GPS speed jitter made
// the card say "Walking" or "Running" while the child stayed in one place. Live
// fixes that stay within GPS drift for 10 s now show "still"; real walking does not.
import { useLocationStore } from "../../store/locationStore";
import type { LocationLog } from "../../types/safetrack";

const CHILD = "00000000-0000-4000-8000-000000000001";
const START = Date.parse("2026-11-15T08:00:00.000Z");
const LAT = 10.2773457; // Babag Barangay Hall
const LON = 123.9451645;
const M_PER_DEG_LAT = 111_320;

function reset(mode: "walking" | "running") {
  const row = {
    id: "row-1",
    childId: CHILD,
    latitude: LAT,
    longitude: LON,
    accuracyMeters: 8,
    source: "smartwatch",
    recordedAt: new Date(START).toISOString(),
    travelMode: mode,
    speedMps: 1.2,
  } as unknown as LocationLog;
  useLocationStore.setState({ latest: row, liveTrail: [] });
}

function fix(second: number, northMeters: number, mode: "walking" | "running", speed: number) {
  const at = START + second * 1000;
  useLocationStore.getState().applyLiveFix({
    childId: CHILD,
    latitude: LAT + northMeters / M_PER_DEG_LAT,
    longitude: LON,
    accuracyMeters: 8,
    source: "smartwatch",
    recordedAt: new Date(at).toISOString(),
    receivedAt: at + 300,
    speedMps: speed,
    headingDegrees: 0,
    travelMode: mode,
    modeConfidence: 0.9,
  } as never);
}

describe("still detection on the live map", () => {
  it("shows 'still' when the watch says walking but the child stays within GPS drift for 10 s", () => {
    reset("walking");
    // 12 fixes, 1 s apart, wobbling up to 3 m around one spot, all reported as "walking" at 1.1 m/s.
    const wobble = [0, 1.5, -1, 2.5, -2, 1, 3, -1.5, 0.5, -3, 2, 0];
    wobble.forEach((m, i) => fix(i + 1, m, "walking", 1.1));
    expect(useLocationStore.getState().latest?.travelMode).toBe("still");
  });

  it("shows 'still' for a 'running' report while staying in place", () => {
    reset("running");
    const wobble = [0, -2, 1, 2, -1, 0, 2.5, -2.5, 1, 0, -1, 1.5];
    wobble.forEach((m, i) => fix(i + 1, m, "running", 2.6));
    expect(useLocationStore.getState().latest?.travelMode).toBe("still");
  });

  it("keeps 'walking' when the child really walks (1.4 m/s for 12 s)", () => {
    reset("walking");
    for (let s = 1; s <= 12; s++) fix(s, s * 1.4, "walking", 1.4);
    expect(useLocationStore.getState().latest?.travelMode).toBe("walking");
  });
});
