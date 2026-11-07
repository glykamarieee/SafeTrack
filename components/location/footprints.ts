import type { LocationLog, TravelMode } from "../../types/safetrack";
import { distanceMeters, type MapFootprint, type MapPoint } from "./mapTypes";

type TrailPoint = { latitude: number; longitude: number; at: number; mode: TravelMode | null };

/** Prints stay this long, fading. */
const WINDOW_MS = 10 * 60_000;
/** Older points are not used, so long walks keep the same prints (stable ids). */
const LOOKBACK_MS = 30 * 60_000;
/**
 * Distance between one print and the next (alternating feet). Wider than a
 * real step so the trail reads clearly at street zoom; running prints are
 * spaced further apart, like a running stride.
 */
const STRIDE_M = { walk: 2.6, run: 4.4 } as const;
/** Half the gap between the left and right prints. */
const SIDE_M = { walk: 0.45, run: 0.35 } as const;
/** Fully visible this long, then fading to FADE_MIN. */
const SOLID_MS = 2 * 60_000;
const FADE_MIN = 0.18;
/** Prints younger than this are animated in. */
const FRESH_MS = 2_500;
const MAX_PRINTS = 400;
/** Over this between two fixes is a gap, not a walk. */
const GAP_M = 150;

const onFoot = (mode: TravelMode | null | undefined) => mode === "walking" || mode === "running";

/**
 * What is drawn behind the child for the last 10 minutes: footprints where
 * the child walked or ran, and the trail line for the current stretch in a
 * vehicle. Saved records and live fixes are combined (live fixes only after
 * the newest saved record). GPS jitter is smoothed so the prints follow a
 * clean path instead of zigzagging.
 */
export function recentTrail(
  latest: LocationLog | null,
  history: LocationLog[],
  live: TrailPoint[],
  now = Date.now(),
): { path: MapPoint[]; footprints: MapFootprint[] } {
  if (!latest) return { path: [], footprints: [] };
  const end = Date.parse(latest.recordedAt);
  const since = end - LOOKBACK_MS;

  const saved: TrailPoint[] = history
    .filter((point) => point.childId === latest.childId && point.id !== latest.id)
    .map((point) => ({ latitude: point.latitude, longitude: point.longitude, at: Date.parse(point.recordedAt), mode: point.travelMode ?? null }))
    .filter((point) => point.at >= since && point.at <= end);
  const lastSaved = saved.reduce((max, point) => Math.max(max, point.at), 0);
  const raw = [
    ...saved,
    ...live.filter((point) => point.at > lastSaved && point.at >= since && point.at < end),
    { latitude: latest.latitude, longitude: latest.longitude, at: end, mode: latest.travelMode ?? null },
  ].sort((first, second) => first.at - second.at);
  const points = smooth(raw);

  const footprints: MapFootprint[] = [];
  // Each walking stretch starts its own left/right sequence, measured from
  // its first point, so prints keep their place (and id) as new fixes arrive.
  let segmentStart = 0;
  let travelled = 0;
  let next = 0;
  let count = 0;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]!;
    const to = points[index]!;
    const length = distanceMeters(from, to);
    if (!onFoot(to.mode) || length > GAP_M) {
      segmentStart = 0;
      travelled = 0;
      next = 0;
      count = 0;
      continue;
    }
    if (length < 0.3) continue;
    if (!segmentStart) segmentStart = from.at;
    const gait = to.mode === "running" ? "run" : "walk";
    const heading = bearing(from, to);
    while (next <= travelled + length) {
      const t = (next - travelled) / length;
      const at = from.at + (to.at - from.at) * t;
      const foot = count % 2 === 0 ? "left" : "right";
      const point = offset(
        { latitude: from.latitude + (to.latitude - from.latitude) * t, longitude: from.longitude + (to.longitude - from.longitude) * t },
        heading + (foot === "left" ? -90 : 90),
        SIDE_M[gait],
      );
      const age = now - at;
      if (age <= WINDOW_MS) {
        const fade = age <= SOLID_MS ? 1 : 1 - ((age - SOLID_MS) / (WINDOW_MS - SOLID_MS)) * (1 - FADE_MIN);
        footprints.push({
          id: `${Math.round(segmentStart / 1000)}:${count}`,
          ...point,
          heading: Math.round(heading),
          opacity: Math.round(Math.max(FADE_MIN, fade) * 100) / 100,
          foot,
          gait,
          fresh: age < FRESH_MS,
        });
      }
      count += 1;
      next += STRIDE_M[gait];
    }
    travelled += length;
  }

  // The line: the current stretch in a vehicle, up to the marker.
  const path: MapPoint[] = [];
  if (!onFoot(latest.travelMode)) {
    const windowStart = end - WINDOW_MS;
    for (let index = raw.length - 2; index >= 0 && !onFoot(raw[index]!.mode) && raw[index]!.at >= windowStart; index -= 1) {
      path.unshift({ latitude: raw[index]!.latitude, longitude: raw[index]!.longitude });
    }
  }

  return { path, footprints: footprints.slice(-MAX_PRINTS) };
}

/**
 * A light moving average (each point with its neighbours) for on-foot
 * stretches: removes the 1-3 m GPS wobble between one-second fixes. The first
 * and last points stay exact, so the trail still ends at the marker.
 */
function smooth(points: TrailPoint[]): TrailPoint[] {
  if (points.length < 3) return points;
  return points.map((point, index) => {
    const before = points[index - 1];
    const after = points[index + 1];
    if (!before || !after || !onFoot(point.mode) || !onFoot(before.mode) || !onFoot(after.mode)) return point;
    if (distanceMeters(before, after) > GAP_M) return point;
    return {
      ...point,
      latitude: (before.latitude + point.latitude * 2 + after.latitude) / 4,
      longitude: (before.longitude + point.longitude * 2 + after.longitude) / 4,
    };
  });
}

function bearing(from: MapPoint, to: MapPoint) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const y = Math.sin(radians(to.longitude - from.longitude)) * Math.cos(radians(to.latitude));
  const x =
    Math.cos(radians(from.latitude)) * Math.sin(radians(to.latitude)) -
    Math.sin(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.cos(radians(to.longitude - from.longitude));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function offset(point: MapPoint, headingDegrees: number, meters: number): MapPoint {
  const radians = (headingDegrees * Math.PI) / 180;
  return {
    latitude: point.latitude + (meters * Math.cos(radians)) / 111_320,
    longitude: point.longitude + (meters * Math.sin(radians)) / (111_320 * Math.max(0.2, Math.cos((point.latitude * Math.PI) / 180))),
  };
}
