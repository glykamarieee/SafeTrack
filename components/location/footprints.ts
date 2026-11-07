import type { LocationLog, TravelMode } from "../../types/safetrack";
import { distanceMeters, type MapFootprint, type MapPoint } from "./mapTypes";

type TrailPoint = { latitude: number; longitude: number; at: number; mode: TravelMode | null };

const WINDOW_MS = 10 * 60_000;
/** One print every this many meters, alternating left and right foot. */
const STEP_M = 5;
/** Half the gap between the left and right prints. */
const SIDE_M = 0.9;
const MAX_PRINTS = 400;

const onFoot = (mode: TravelMode | null | undefined) => mode === "walking" || mode === "running";

/**
 * What is drawn behind the child for the last 10 minutes: footprints where
 * the child walked or ran, and the trail line for the current stretch on a
 * bike or in a vehicle. Saved records and live fixes are combined (live fixes
 * only after the newest saved record).
 */
export function recentTrail(
  latest: LocationLog | null,
  history: LocationLog[],
  live: TrailPoint[],
  now = Date.now(),
): { path: MapPoint[]; footprints: MapFootprint[] } {
  if (!latest) return { path: [], footprints: [] };
  const end = Date.parse(latest.recordedAt);
  const since = end - WINDOW_MS;

  const saved: TrailPoint[] = history
    .filter((point) => point.childId === latest.childId && point.id !== latest.id)
    .map((point) => ({ latitude: point.latitude, longitude: point.longitude, at: Date.parse(point.recordedAt), mode: point.travelMode ?? null }))
    .filter((point) => point.at >= since && point.at <= end);
  const lastSaved = saved.reduce((max, point) => Math.max(max, point.at), 0);
  const points = [...saved, ...live.filter((point) => point.at > lastSaved && point.at >= since && point.at < end)].sort(
    (first, second) => first.at - second.at,
  );

  const footprints: MapFootprint[] = [];
  let side = 1;
  let carry = 0;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]!;
    const to = points[index]!;
    if (!onFoot(to.mode)) {
      carry = 0;
      continue;
    }
    const length = distanceMeters(from, to);
    // Over 150 m between two fixes is a gap, not a walk.
    if (length < 0.5 || length > 150) continue;
    const heading = bearing(from, to);
    const opacity = Math.max(0.25, Math.min(1, 1 - (now - to.at) / WINDOW_MS));
    for (let at = STEP_M - carry; at <= length; at += STEP_M) {
      const t = at / length;
      const point = offset(
        { latitude: from.latitude + (to.latitude - from.latitude) * t, longitude: from.longitude + (to.longitude - from.longitude) * t },
        heading + 90 * side,
        SIDE_M,
      );
      footprints.push({ ...point, heading, opacity: Math.round(opacity * 100) / 100 });
      side = -side;
    }
    carry = (length + carry) % STEP_M;
  }

  // The line: the current stretch on a bike or in a vehicle, up to the marker.
  const path: MapPoint[] = [];
  if (!onFoot(latest.travelMode)) {
    for (let index = points.length - 1; index >= 0 && !onFoot(points[index]!.mode); index -= 1) {
      path.unshift({ latitude: points[index]!.latitude, longitude: points[index]!.longitude });
    }
  }

  return { path, footprints: footprints.slice(-MAX_PRINTS) };
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
