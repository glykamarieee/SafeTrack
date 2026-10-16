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
export function segments(points: Point[]) {
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

type Routed = { line: LatLng[]; legs: number[] };

/** Road route through the waypoints in order (Mapbox Directions, walking). */
async function routeChunk(chunk: Point[]): Promise<Routed | null> {
  if (chunk.length < 2) return null;
  const coordinates = chunk.map((point) => `${point.longitude.toFixed(6)},${point.latitude.toFixed(6)}`).join(";");
  // Snap each record to the nearest road within its GPS accuracy.
  const radiuses = chunk.map((point) => Math.round(Math.min(80, Math.max(25, (point.accuracy ?? 30) * 2)))).join(";");
  // Walking: follows every street in both directions, so one-way rules
  // never add loops around a block.
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinates}` +
    `?geometries=geojson&overview=full&radiuses=${radiuses}&access_token=${TOKEN}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const body = (await response.json()) as {
      code?: string;
      routes?: { geometry?: { coordinates?: [number, number][] }; legs?: { distance?: number }[] }[];
    };
    const route = body.code === "Ok" ? body.routes?.[0] : undefined;
    const coords = route?.geometry?.coordinates;
    if (!coords || coords.length < 2) return null;
    return {
      line: coords.map(([longitude, latitude]) => ({ latitude, longitude })),
      legs: (route?.legs ?? []).map((leg) => leg.distance ?? 0),
    };
  } catch {
    return null;
  }
}

/**
 * Removes GPS noise before routing:
 * - a stay in one place becomes a single waypoint (see STAY_RADIUS_M);
 * - "spikes": a record that goes off to the side and comes back, i.e. going
 *   A -> B -> C is much longer than A -> C. Forcing the route through such a
 *   record is what drew triangles and loops off the real path.
 */
const STAY_RADIUS_M = 150;
const TRIM_M = 150;
export function cleanWaypoints(chunk: Point[]) {
  // Staying in one place (school, home): the watch keeps recording small GPS
  // wobbles around the building. All records within STAY_RADIUS_M of where
  // the stay began become one waypoint at their centre, so the route arrives
  // there once instead of looping between the wobbles.
  const kept: Point[] = [];
  let group: Point[] = [];
  const flush = () => {
    if (!group.length) return;
    const latitude = group.reduce((sum, point) => sum + point.latitude, 0) / group.length;
    const longitude = group.reduce((sum, point) => sum + point.longitude, 0) / group.length;
    kept.push({ ...group[0]!, latitude, longitude, accuracy: Math.min(...group.map((point) => point.accuracy ?? 30)) });
    group = [];
  };
  for (const point of chunk) {
    if (group.length && meters(group[0]!, point) <= STAY_RADIUS_M) {
      group.push(point);
    } else {
      flush();
      group = [point];
    }
  }
  flush();

  let changed = true;
  while (changed && kept.length > 2) {
    changed = false;
    for (let index = 1; index < kept.length - 1; index += 1) {
      const a = kept[index - 1]!;
      const b = kept[index]!;
      const c = kept[index + 1]!;
      const via = meters(a, b) + meters(b, c);
      const direct = meters(a, c);
      if (via > direct * 1.6 + 150) {
        kept.splice(index, 1);
        changed = true;
        break;
      }
    }
  }
  return kept;
}

/**
 * Routes the waypoints, then removes any waypoint whose leg is a detour (the
 * road route there is far longer than the straight distance, a sign of a
 * misplaced GPS fix) and routes again, up to 3 times.
 */
async function routeClean(waypoints: Point[]): Promise<LatLng[] | null> {
  let current = waypoints;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const routed = await routeChunk(current);
    if (!routed) return null;
    if (attempt === 3 || current.length <= 2) return routed.line;
    let worst = -1;
    let worstRatio = 0;
    for (let leg = 0; leg < routed.legs.length; leg += 1) {
      const straight = meters(current[leg]!, current[leg + 1]!);
      const ratio = routed.legs[leg]! / (straight + 200);
      if (ratio > 2 && ratio > worstRatio) {
        worstRatio = ratio;
        worst = leg;
      }
    }
    if (worst < 0) return routed.line;
    // Drop the misplaced end of that leg (never the first or last record).
    const drop = worst + 1 < current.length - 1 ? worst + 1 : worst;
    if (drop <= 0 || drop >= current.length - 1) return routed.line;
    current = current.filter((_, index) => index !== drop);
  }
  return null;
}

/** Map matching for dense stretches, road routing for sparse ones. */
async function snapChunk(chunk: Point[]): Promise<LatLng[] | null> {
  const waypoints = cleanWaypoints(chunk);
  if (waypoints.length < 2) return null;
  let dense = true;
  for (let index = 1; index < waypoints.length; index += 1) {
    if (meters(waypoints[index - 1]!, waypoints[index]!) > MATCH_MAX_STEP_M) {
      dense = false;
      break;
    }
  }
  if (dense) {
    const matched = await matchChunk(waypoints);
    if (matched) return matched;
  }
  // Each leg between waypoints is routed on its own and trimmed near both
  // ends: Mapbox otherwise routes to a footpath inside a campus or estate,
  // drawing loops past the gate and back. The road line stops where it first
  // comes within TRIM_M of the stay, then a short connector reaches it.
  const line: LatLng[] = [];
  const at = (point: Point) => ({ latitude: point.latitude, longitude: point.longitude });
  for (let index = 1; index < waypoints.length; index += 1) {
    const from = waypoints[index - 1]!;
    const to = waypoints[index]!;
    const routed = await routeClean([from, to]);
    if (!routed || routed.length < 2) {
      line.push(at(from), at(to));
      continue;
    }
    let first = 0;
    for (let k = 0; k < routed.length; k += 1) {
      if (meters(from, routed[k]!) <= TRIM_M) first = k;
      else if (k > 0 && meters(from, routed[k]!) > TRIM_M * 2) break;
    }
    let last = routed.length - 1;
    for (let k = first; k < routed.length; k += 1) {
      if (meters(to, routed[k]!) <= TRIM_M) {
        last = k;
        break;
      }
    }
    line.push(at(from), ...routed.slice(first, last + 1), at(to));
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
