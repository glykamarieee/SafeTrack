/**
 * Footprints behind a walking child (2026-11-15: prints were too big, too
 * sparse and did not follow the real path). Pure function: no server, no map.
 */
import { recentTrail } from "../../components/location/footprints";
import { distanceMeters } from "../../components/location/mapTypes";
import type { LocationLog } from "../../types/safetrack";

const START = Date.parse("2026-11-15T09:40:00Z");
const BASE = { latitude: 10.2770, longitude: 123.9450 };
const M_LAT = 1 / 111_320;

/** A point `north` meters north of BASE, `east` meters east, `seconds` after START. */
function fix(seconds: number, north: number, east = 0, accuracy = 8, mode: "walking" | "still" = "walking") {
  return {
    latitude: BASE.latitude + north * M_LAT,
    longitude: BASE.longitude + (east * M_LAT) / Math.cos((BASE.latitude * Math.PI) / 180),
    at: START + seconds * 1000,
    mode,
    accuracy,
  };
}

function latest(point: ReturnType<typeof fix>): LocationLog {
  return {
    id: "latest",
    childId: "child-1",
    latitude: point.latitude,
    longitude: point.longitude,
    accuracyMeters: point.accuracy,
    source: "smartwatch",
    recordedAt: new Date(point.at).toISOString(),
    travelMode: point.mode,
  } as LocationLog;
}

describe("footprints", () => {
  it("follow a straight 30 m walk with one print per ~1.2 m, alternating feet, close to the path", () => {
    // 1 s fixes at 1.2 m/s with ±1 m sideways GPS wobble.
    const live = Array.from({ length: 25 }, (_, s) => fix(s, s * 1.2, s % 2 ? 1 : -1));
    const end = fix(25, 30);
    const { footprints } = recentTrail(latest(end), [], live, end.at);

    expect(footprints.length).toBeGreaterThanOrEqual(18);
    expect(footprints.length).toBeLessThanOrEqual(26);
    footprints.forEach((print, index) => {
      expect(print.foot).toBe(index % 2 === 0 ? "left" : "right");
      // Never more than 1.5 m off the line walked.
      const east = distanceMeters({ latitude: print.latitude, longitude: BASE.longitude }, print);
      expect(east).toBeLessThan(1.5);
    });
    // Consecutive prints are not on top of each other.
    for (let index = 1; index < footprints.length; index += 1) {
      expect(distanceMeters(footprints[index - 1]!, footprints[index]!)).toBeGreaterThan(0.6);
    }
  });

  it("draws no prints for GPS drift while the child stands still", () => {
    const live = Array.from({ length: 60 }, (_, s) => fix(s, (s % 3) * 0.8, (s % 2) * 0.8));
    const end = fix(60, 0.5, 0.5);
    expect(recentTrail(latest(end), [], live, end.at).footprints).toHaveLength(0);
  });

  it("leaves out fixes with poor accuracy", () => {
    const good = Array.from({ length: 20 }, (_, s) => fix(s, s * 1.2));
    // A 40 m-accuracy fix 25 m to the side must not pull the trail.
    const live = [...good.slice(0, 10), fix(10.5, 12.6, 25, 40), ...good.slice(10)];
    const end = fix(20, 24);
    const { footprints } = recentTrail(latest(end), [], live, end.at);
    footprints.forEach((print) => {
      expect(distanceMeters({ latitude: print.latitude, longitude: BASE.longitude }, print)).toBeLessThan(1.5);
    });
  });
});
