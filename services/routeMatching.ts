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
/** `gapAfter`: no road could be found from here to the next point (drawn dashed grey). */
export type LatLng = { latitude: number; longitude: number; gapAfter?: boolean };

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

/** Map Matching with the likely profile, then the other one (highways aren't walkable). */
async function matchChunk(chunk: Point[]): Promise<LatLng[] | null> {
  if (chunk.length < 2) return null;
  const first = travelProfile(chunk);
  return (await matchOnce(chunk, first)) ?? (await matchOnce(chunk, first === "walking" ? "driving" : "walking"));
}

async function matchOnce(chunk: Point[], profile: Profile): Promise<LatLng[] | null> {
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

type Profile = "walking" | "driving";

/** Moving faster than walking between the first and last record: a vehicle. */
function travelProfile(chunk: Point[]): Profile {
  const first = chunk[0]!;
  const last = chunk[chunk.length - 1]!;
  const seconds = (Date.parse(last.recordedAt) - Date.parse(first.recordedAt)) / 1000;
  let distance = 0;
  for (let index = 1; index < chunk.length; index += 1) distance += meters(chunk[index - 1]!, chunk[index]!);
  return seconds > 0 && distance / seconds > DRIVING_SPEED_MPS ? "driving" : "walking";
}

/**
 * Road route through the waypoints in order (Mapbox Directions). Tries the
 * likely way of travelling first, then the other one, then the same without
 * the snapping limit: walking routes can't use highways, and a record taken
 * on a highway is often more than 80 m from any walkable road, which made
 * Mapbox find no route and the History line fall back to straight lines.
 */
async function routeChunk(chunk: Point[]): Promise<Routed | null> {
  if (chunk.length < 2) return null;
  const first = travelProfile(chunk);
  const second: Profile = first === "walking" ? "driving" : "walking";
  // Widen the snapping step by step, so the route ends on the road nearest
  // the record instead of one far away.
  for (const cap of [80, 250, 500, null]) {
    const routed = (await routeOnce(chunk, first, cap)) ?? (await routeOnce(chunk, second, cap));
    if (routed) return routed;
  }
  return null;
}

async function routeOnce(chunk: Point[], profile: Profile, cap: number | null): Promise<Routed | null> {
  const coordinates = chunk.map((point) => `${point.longitude.toFixed(6)},${point.latitude.toFixed(6)}`).join(";");
  // Snap each record to the nearest road within its GPS accuracy (or to the
  // nearest road at any distance, as a last resort).
  const radiuses = chunk
    .map((point) => (cap === null ? "unlimited" : Math.round(Math.min(cap, Math.max(25, (point.accuracy ?? 30) * 2, cap === 80 ? 0 : cap)))))
    .join(";");
  // Walking follows every street in both directions, so one-way rules never
  // add loops around a block; driving is needed on highways.
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}` +
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
const SPIKE_MAX_M = 500;
const CONNECTOR_MAX_M = 200;
const LEG_CONCURRENCY = 4;
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
      // Only small side-steps are GPS spikes. A far point is a real place the
      // child went (home -> school -> home with one record at school looks
      // like "out and straight back" too, and was wrongly removed).
      const small = meters(a, b) <= SPIKE_MAX_M && meters(b, c) <= SPIKE_MAX_M;
      if (small && via > direct * 1.6 + 150) {
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
  // Legs are fetched a few at a time (much faster than one by one).
  const legs: (LatLng[] | null)[] = new Array(waypoints.length - 1).fill(null);
  let nextLeg = 0;
  const worker = async () => {
    while (nextLeg < legs.length) {
      const leg = nextLeg++;
      legs[leg] = await routeClean([waypoints[leg]!, waypoints[leg + 1]!]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(LEG_CONCURRENCY, legs.length) }, worker));
  for (let index = 1; index < waypoints.length; index += 1) {
    const from = waypoints[index - 1]!;
    const to = waypoints[index]!;
    const routed = legs[index - 1];
    if (!routed || routed.length < 2) {
      // No road found even after every fallback: an unknown stretch.
      line.push({ ...at(from), gapAfter: true }, at(to));
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
    // Short connectors from the road to the record (a stop inside a campus or
    // estate) stay solid; a long one is an unknown stretch.
    const road = routed.slice(first, last + 1);
    const start = { ...at(from), gapAfter: meters(from, road[0]!) > CONNECTOR_MAX_M };
    const end = road[road.length - 1]!;
    road[road.length - 1] = { ...end, gapAfter: meters(end, to) > CONNECTOR_MAX_M };
    line.push(start, ...road, at(to));
  }
  return line.length >= 2 ? line : null;
}

// A rough fix (Wi-Fi or cell estimate) can be kilometres off.
const ROUGH_ACCURACY_M = 150;
// Faster than any car in the city: the record is a GPS jump.
const JUMP_SPEED_MPS = 150 / 3.6;

/**
 * Leaves out of the drawn line (never out of the records):
 * - rough fixes, when there are precise ones to draw instead;
 * - jumps: a record reached impossibly fast from the previous one and left
 *   impossibly fast for the next, i.e. out and straight back.
 * Each of these drew a long straight spike across the map.
 */
export function plausiblePoints(points: Point[]) {
  const precise = points.filter((point) => (point.accuracy ?? 0) <= ROUGH_ACCURACY_M);
  const list = precise.length >= 2 ? precise : points;
  const speed = (a: Point, b: Point) =>
    meters(a, b) / Math.max(1, (Date.parse(b.recordedAt) - Date.parse(a.recordedAt)) / 1000);
  const kept: Point[] = [];
  for (let index = 0; index < list.length; index += 1) {
    const point = list[index]!;
    const before = kept[kept.length - 1];
    const after = list[index + 1];
    if (before && after && speed(before, point) > JUMP_SPEED_MPS && speed(point, after) > JUMP_SPEED_MPS) continue;
    kept.push(point);
  }
  return kept;
}

/** Records left out of the drawn line, and why (for the explanation sheet). */
export function lineExclusions(points: Point[]): { rough: number; jumps: number } {
  const precise = points.filter((point) => (point.accuracy ?? 0) <= ROUGH_ACCURACY_M);
  const rough = precise.length >= 2 ? points.length - precise.length : 0;
  const jumps = (precise.length >= 2 ? precise.length : points.length) - plausiblePoints(points).length;
  return { rough, jumps };
}

async function matchAll(points: Point[]): Promise<LatLng[] | null> {
  const line: LatLng[] = [];
  let snappedAny = false;

  for (const segment of segments(plausiblePoints(points))) {
    // Records more than GAP_MS apart: the path in between is unknown.
    if (line.length) line[line.length - 1] = { ...line[line.length - 1]!, gapAfter: true };
    for (let start = 0; start < segment.length; start += MAX_COORDS - 1) {
      const chunk = segment.slice(start, start + MAX_COORDS);
      if (chunk.length < 2) {
        if (chunk[0]) line.push({ latitude: chunk[0].latitude, longitude: chunk[0].longitude });
        continue;
      }
      const snapped = await snapChunk(chunk);
      const stay = cleanWaypoints(chunk);
      if (!snapped && stay.length < 2) {
        // Staying in one place: one point, no line (wobble is not a path).
        line.push({ latitude: stay[0]!.latitude, longitude: stay[0]!.longitude });
        continue;
      }
      if (snapped) {
        snappedAny = true;
        line.push(...snapped);
      } else {
        // Not matched: the recorded points, joined by unknown (dashed) stretches.
        line.push(...chunk.map(({ latitude, longitude }, index) => ({ latitude, longitude, gapAfter: index < chunk.length - 1 })));
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
