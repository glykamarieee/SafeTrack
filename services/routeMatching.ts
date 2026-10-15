/**
 * Draws a day's recorded route along real roads, so the History line
 * follows the streets instead of straight lines between records: Mapbox
 * Map Matching where records are close together, and Mapbox Directions
 * (the road route through each record in order) where they are far apart. The records themselves are never changed: this only
 * changes how the line between them is drawn.
 *
 * - Uses the public map token (EXPO_PUBLIC_MAPBOX_TOKEN). Without it, or for
 *   any part Mapbox cannot match, that part stays a straight line.
 * - Points within GPS wobble of the previous one are skipped (standing still).
 * - The day is split where records are more than GAP_MS apart; the gaps stay
 *   straight because the path in between is unknown.
 * - At most 100 coordinates per request (the API limit), chunks overlap by
 *   one point so the line is continuous.
 * - Walking roads by default; driving roads for fast stretches (vehicles).
 */

type Point = { latitude: number; longitude: number; accuracy?: number | null; recordedAt: string };
export type LatLng = { latitude: number; longitude: number };

const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";
const MAX_COORDS = 100;
const MAX_WAYPOINTS = 25;
// Records further apart than this cannot be map-matched (the watch saves
// about every 3 minutes); those stretches are routed along roads instead.
const MATCH_MAX_STEP_M = 400;
const GAP_MS = 6 * 60 * 60 * 1000;
const MIN_MOVE_M = 20;
const DRIVING_SPEED_MPS = 25 / 3.6;

const cache = new Map<string, Promise<LatLng[] | null>>();

function meters(a: LatLng, b: LatLng) {
  const r = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) * Math.cos((b.latitude * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

/** Drops stationary wobble and splits at long gaps. */
function segments(points: Point[]) {
  const result: Point[][] = [];
  let current: Point[] = [];
  for (const point of points) {
    const last = current[current.length - 1];
    if (last && Date.parse(point.recordedAt) - Date.parse(last.recordedAt) > GAP_MS) {
      if (current.length) result.push(current);
      current = [point];
      continue;
    }
    if (!last || meters(last, point) >= Math.max(MIN_MOVE_M, Math.min(point.accuracy ?? 0, 60))) {
      current.push(point);
    }
  }
  if (current.length) result.push(current);
  return result;
}

async function matchChunk(chunk: Point[]): Promise<LatLng[] | null> {
  if (chunk.length < 2) return null;

  const first = chunk[0];
  const last = chunk[chunk.length - 1];
  const seconds = Math.max(1, (Date.parse(last.recordedAt) - Date.parse(first.recordedAt)) / 1000);
  let distance = 0;
  for (let index = 1; index < chunk.length; index += 1) distance += meters(chunk[index - 1], chunk[index]);
  const profile = distance / seconds > DRIVING_SPEED_MPS ? "driving" : "walking";

  const coordinates = chunk.map((point) => `${point.longitude.toFixed(6)},${point.latitude.toFixed(6)}`).join(";");
  const radiuses = chunk.map((point) => Math.round(Math.min(50, Math.max(15, (point.accuracy ?? 25) * 1.5)))).join(";");
  let previous = 0;
  const timestamps = chunk
    .map((point) => {
      // Timestamps must strictly increase.
      const value = Math.max(Math.floor(Date.parse(point.recordedAt) / 1000), previous + 1);
      previous = value;
      return value;
    })
    .join(";");

  const url =
    `https://api.mapbox.com/matching/v5/mapbox/${profile}/${coordinates}` +
    `?geometries=geojson&overview=full&tidy=true&radiuses=${radiuses}&timestamps=${timestamps}&access_token=${TOKEN}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const body = (await response.json()) as {
      code?: string;
      matchings?: { geometry?: { coordinates?: [number, number][] } }[];
    };
    if (body.code !== "Ok" || !body.matchings?.length) return null;

    const line: LatLng[] = [];
    for (const matching of body.matchings) {
      for (const [longitude, latitude] of matching.geometry?.coordinates ?? []) {
        line.push({ latitude, longitude });
      }
    }
    return line.length >= 2 ? line : null;
  } catch {
    return null;
  }
}

/** Road route through the records in order (Mapbox Directions, driving). */
async function routeChunk(chunk: Point[]): Promise<LatLng[] | null> {
  if (chunk.length < 2) return null;
  const coordinates = chunk.map((point) => `${point.longitude.toFixed(6)},${point.latitude.toFixed(6)}`).join(";");
  // Allow each record to snap to the nearest road within its GPS accuracy.
  const radiuses = chunk.map((point) => Math.round(Math.min(80, Math.max(25, (point.accuracy ?? 30) * 2)))).join(";");
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}` +
    `?geometries=geojson&overview=full&continue_straight=true&radiuses=${radiuses}&access_token=${TOKEN}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const body = (await response.json()) as { code?: string; routes?: { geometry?: { coordinates?: [number, number][] } }[] };
    const coords = body.code === "Ok" ? body.routes?.[0]?.geometry?.coordinates : undefined;
    if (!coords || coords.length < 2) return null;
    return coords.map(([longitude, latitude]) => ({ latitude, longitude }));
  } catch {
    return null;
  }
}

/** Map matching for dense stretches, road routing for sparse ones. */
async function snapChunk(chunk: Point[]): Promise<LatLng[] | null> {
  let dense = true;
  for (let index = 1; index < chunk.length; index += 1) {
    if (meters(chunk[index - 1], chunk[index]) > MATCH_MAX_STEP_M) {
      dense = false;
      break;
    }
  }
  if (dense) {
    const matched = await matchChunk(chunk);
    if (matched) return matched;
  }
  // Directions accepts 25 waypoints per request; chunks overlap by one.
  const line: LatLng[] = [];
  for (let start = 0; start < chunk.length - 1; start += MAX_WAYPOINTS - 1) {
    const part = chunk.slice(start, start + MAX_WAYPOINTS);
    const routed = await routeChunk(part);
    if (routed) {
      line.push(...routed);
      continue;
    }
    // One record Mapbox can't place on a road (e.g. a GPS fix over water)
    // fails the whole request: route record by record instead, so only the
    // hop touching that record stays straight.
    for (let index = 1; index < part.length; index += 1) {
      const pair = await routeChunk([part[index - 1], part[index]]);
      if (pair) line.push(...pair);
      else line.push(
        { latitude: part[index - 1].latitude, longitude: part[index - 1].longitude },
        { latitude: part[index].latitude, longitude: part[index].longitude },
      );
    }
  }
  return line.length >= 2 ? line : null;
}

async function matchAll(points: Point[]): Promise<LatLng[] | null> {
  const line: LatLng[] = [];
  let snappedAny = false;

  for (const segment of segments(points)) {
    for (let start = 0; start < segment.length; start += MAX_COORDS - 1) {
      const chunk = segment.slice(start, start + MAX_COORDS);
      if (chunk.length < 2) {
        if (chunk[0]) line.push({ latitude: chunk[0].latitude, longitude: chunk[0].longitude });
        continue;
      }
      const snapped = await snapChunk(chunk);
      if (snapped) {
        snappedAny = true;
        line.push(...snapped);
      } else {
        // Not matched: keep the recorded points, joined by straight lines.
        line.push(...chunk.map(({ latitude, longitude }) => ({ latitude, longitude })));
      }
    }
  }

  return snappedAny ? line : null;
}

/**
 * The route drawn along roads, or null when nothing could be matched (no
 * token, offline, or Mapbox found no road). Cached per day and record set.
 */
export function matchRouteToRoads(cacheKey: string, points: Point[]): Promise<LatLng[] | null> {
  if (!TOKEN || points.length < 2) return Promise.resolve(null);
  const key = `${cacheKey}:${points.length}:${points[points.length - 1]?.recordedAt ?? ""}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = matchAll(points).catch(() => null);
    cache.set(key, pending);
    // Failed (null) results are retried on the next visit.
    pending.then((value) => {
      if (!value) cache.delete(key);
    });
  }
  return pending;
}
