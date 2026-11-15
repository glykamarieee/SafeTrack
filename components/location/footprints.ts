import type { LocationLog, TravelMode } from "../../types/safetrack";
import { distanceMeters, type MapFootprint, type MapPoint } from "./mapTypes";

type TrailPoint = { latitude: number; longitude: number; at: number; mode: TravelMode | null; accuracy?: number | null };

/** Prints stay this long, fading. */
const WINDOW_MS = 10 * 60_000;
/** Older points are not used, so long walks keep the same prints (stable ids). */
const LOOKBACK_MS = 30 * 60_000;
/**
 * Distance between one print and the next (alternating feet), in meters on
 * the ground (2026-11-15: 2.6 m looked too sparse and the prints too big). A
 * real step is ~0.7 m; 1.2 m keeps the prints (drawn ~0.6 m long, see
 * FOOT_SIZE in MapboxRenderer) from touching, so the trail stays clean.
 */
const STRIDE_M = { walk: 1.2, run: 1.8 } as const;
/** Half the gap between the left and right prints. */
const SIDE_M = { walk: 0.18, run: 0.14 } as const;
/** Fixes less accurate than this are not used for prints (the last point always is). */
const MAX_ACCURACY_M = 20;
/**
 * A fix this close to the last one used is GPS drift, not a step: between
 * 1.5 and 5 m, depending on the fix's accuracy. Stops prints appearing while
 * the child stands still, and stops the trail zigzagging.
 */
const minMove = (accuracy: number | null | undefined) => Math.min(5, Math.max(1.5, (accuracy ?? 5) * 0.4));
/** Fully visible this long, then fading to FADE_MIN. */
const SOLID_MS = 2 * 60_000;
const FADE_MIN = 0.18;
/** Prints younger than this are animated in. */
const FRESH_MS = 2_500;
const MAX_PRINTS = 700;
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
    .map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
      at: Date.parse(point.recordedAt),
      mode: point.travelMode ?? null,
      accuracy: point.accuracyMeters ?? null,
    }))
    .filter((point) => point.at >= since && point.at <= end);
  const lastSaved = saved.reduce((max, point) => Math.max(max, point.at), 0);
  const raw = [
    ...saved,
    ...live.filter((point) => point.at > lastSaved && point.at >= since && point.at < end),
    { latitude: latest.latitude, longitude: latest.longitude, at: end, mode: latest.travelMode ?? null, accuracy: latest.accuracyMeters ?? null },
  ].sort((first, second) => first.at - second.at);
  const points = smooth(steady(raw));

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
    // Under 1 m to the marker is drift too (the marker's own point is always kept).
    if (length < 1) continue;
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
 * On-foot fixes that can be trusted: poor fixes (over MAX_ACCURACY_M) and
 * fixes that only drifted from the last one kept (minMove) are dropped. Other
 * points (vehicle stretches) and the last point (the marker) are always kept.
 */
function steady(points: TrailPoint[]): TrailPoint[] {
  const kept: TrailPoint[] = [];
  points.forEach((point, index) => {
    const last = index === points.length - 1;
    const previous = kept[kept.length - 1];
    if (!last && onFoot(point.mode)) {
      if (point.accuracy != null && point.accuracy > MAX_ACCURACY_M) return;
      if (previous && onFoot(previous.mode) && distanceMeters(previous, point) < minMove(point.accuracy)) return;
    }
    kept.push(point);
  });
  return kept;
}

/**
 * A moving average over five points (weights 1-2-3-2-1) for on-foot
 * stretches: removes the GPS wobble so the prints follow the path walked. The
 * first and last points stay exact, so the trail still ends at the marker.
 */
function smooth(points: TrailPoint[]): TrailPoint[] {
  if (points.length < 3) return points;
  return points.map((point, index) => {
    if (index === 0 || index === points.length - 1 || !onFoot(point.mode)) return point;
    let latitude = 0;
    let longitude = 0;
    let total = 0;
    for (let offset = -2; offset <= 2; offset += 1) {
      const near = points[index + offset];
      if (!near || !onFoot(near.mode) || distanceMeters(near, point) > GAP_M) continue;
      const weight = 3 - Math.abs(offset);
      latitude += near.latitude * weight;
      longitude += near.longitude * weight;
      total += weight;
    }
    return { ...point, latitude: latitude / total, longitude: longitude / total };
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
