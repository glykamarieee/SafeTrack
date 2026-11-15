import { supabase } from "./supabase";

/**
 * Street address and nearest landmark for a point, from OpenStreetMap
 * (Nominatim, free; results may be stored under the ODbL, credited as
 * "© OpenStreetMap contributors" in Help & Support and the map's ⓘ).
 *
 * Nominatim's usage policy allows at most one request per second and asks
 * that results are cached, so:
 *  - points are grouped into ~55 m cells (the same cell as location_cell() in
 *    migration 20261104);
 *  - each cell is looked up once: memory, then the shared location_places
 *    table, then Nominatim, and the result is saved back;
 *  - requests queue one second apart.
 * Where OpenStreetMap has no street (inside subdivisions), the street comes
 * from Mapbox (mapboxAddress) and is kept in memory only.
 * Before the migration runs the database steps fail quietly and only the
 * memory cache is used.
 *
 * Shown as fast as possible (panel feedback 2026-11-08): the street and
 * barangay appear as soon as the first lookup answers, the landmark is added
 * when the second one does (onPlaceChange), the nearest known place is shown
 * meanwhile ("Near …", nearbyPlace), and the cell ahead of a moving child is
 * looked up before they reach it (prefetchAhead).
 *
 * The child's exact spot decides the name (2026-11-15: at Babag Barangay Hall
 * the card said "Manuel L. Quezon National Highway", the address of the first
 * point looked up in that cell). Each cell keeps the named places found in it
 * (`spots`, with their positions); placeAt() puts the one the child is at
 * (within AT_PLACE_M) first and leaves the street out:
 * "Babag Barangay Hall, Brgy. Babag, Lapu-Lapu City". When the child is not
 * at a known spot, the exact point is checked once more (spotsNear).
 */
export type Spot = { name: string; latitude: number; longitude: number };

export type Place = {
  /** "Babag Barangay Hall, Brgy. Babag, Lapu-Lapu City" or "Rizal Ave, Brgy. 495, Caloocan City" */
  label: string;
  /** The named place the child is at (school, store, barangay hall...). */
  name?: string;
  /** Named places found in this cell, with their positions. */
  spots?: Spot[];
  /** Format of the saved details; older rows are looked up again. */
  v?: number;
  road?: string;
  barangay?: string;
  city?: string;
  province?: string;
  landmark?: { name: string; distanceMeters: number } | null;
  /** The point is on water (sea, bay, river): used to show "On a boat". */
  water?: boolean;
  /** A neighbouring cell's place, shown while this cell is looked up. */
  near?: boolean;
  /** The street came from Mapbox: kept in memory only, never saved. */
  mapbox?: boolean;
};

/** Saved details older than this format are looked up again. */
const PLACE_VERSION = 2;
/** The child is "at" a named place within this distance of its point. */
export const AT_PLACE_M = 40;
/** A named place this far away is still shown as "Near …". */
const LANDMARK_M = 400;

const NOMINATIM = "https://nominatim.openstreetmap.org/reverse";
const MIN_GAP_MS = 1100;
const MAPBOX_REVERSE = "https://api.mapbox.com/search/geocode/v6/reverse";
const MAPBOX_TIMEOUT_MS = 4000;

export function placeCell(latitude: number, longitude: number) {
  return `${Math.floor(latitude * 2000)}:${Math.floor(longitude * 2000)}`;
}

const memory = new Map<string, Place | null>();
const pending = new Map<string, Promise<Place | null>>();
const listeners = new Set<(cell: string, place: Place | null) => void>();

/** Called when a cell's place is found or completed (landmark added). */
export function onPlaceChange(listener: (cell: string, place: Place | null) => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

function remember(cell: string, place: Place | null) {
  memory.set(cell, place);
  listeners.forEach((listener) => listener(cell, place));
}
let queue: Promise<unknown> = Promise.resolve();
let lastRequest = 0;

function throttled<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(async () => {
    const wait = lastRequest + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequest = Date.now();
    return task();
  });
  queue = next.catch(() => undefined);
  return next;
}

async function nominatim(latitude: number, longitude: number, layer?: "poi,manmade") {
  const params = new URLSearchParams({
    format: "jsonv2",
    lat: String(latitude),
    lon: String(longitude),
    zoom: "18",
    addressdetails: "1",
    "accept-language": "en",
  });
  if (layer) params.set("layer", layer);
  return throttled(async () => {
    const response = await fetch(`${NOMINATIM}?${params}`, {
      // Identifies the app, as the usage policy asks (browsers ignore it and send their Referer).
      headers: { "User-Agent": "SafeTrack/1.0 (child safety capstone app)", Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Address lookup failed (${response.status}).`);
    return (await response.json()) as Record<string, any>;
  });
}

function metersBetween(aLat: number, aLng: number, bLat: number, bLng: number) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(bLat - aLat);
  const dLng = radians(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(aLat)) * Math.cos(radians(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const WATER_TYPES = new Set(["water", "bay", "strait", "sea", "ocean", "river", "riverbank", "coastline", "reservoir"]);

/**
 * Builds the place from a Nominatim answer; null when there is no address.
 * A named answer without a position is placed at the looked-up point.
 */
export function toPlace(result: Record<string, any>, latitude?: number, longitude?: number): Place | null {
  const a = (result.address ?? {}) as Record<string, string | undefined>;
  // At sea Nominatim answers with the town's boundary and no street or
  // barangay, or with nothing at all.
  const water =
    result.error != null ||
    result.category === "waterway" ||
    (result.category === "natural" && WATER_TYPES.has(result.type)) ||
    (result.category === "boundary" && !a.road && !a.quarter && !a.suburb && !a.village && !a.neighbourhood && !a.hamlet);
  const road = [a.house_number, a.road ?? a.pedestrian ?? a.footway ?? a.path].filter(Boolean).join(" ") || undefined;
  // Barangays are mapped at different levels in OSM; use the first one present.
  const barangayRaw = a.quarter ?? a.suburb ?? a.village ?? a.neighbourhood ?? a.hamlet;
  const barangay = barangayName(barangayRaw);
  const city = a.city ? cityName(a.city) : a.town ?? a.municipality ?? a.county;
  const province = a.state ?? a.province ?? a.region;
  const name = typeof result.name === "string" && result.name.trim() && result.name !== a.road ? result.name.trim() : undefined;
  const spot = name ? spotOf(name, result.lat ?? latitude, result.lon ?? longitude) : null;
  const base: Place = { label: "", road, barangay, city, province, water, spots: spot ? [spot] : [], v: PLACE_VERSION };
  if (!name && !road && !barangay && !city && !province) return water ? { label: "", water: true } : null;
  // Where the answer has a name but no position, it still names the looked-up point.
  if (name && !spot) base.name = name;
  return { ...base, label: labelOf(base) };
}

function barangayName(raw: string | undefined) {
  return raw ? (/^(barangay|brgy)/i.test(raw) ? raw : `Brgy. ${raw}`) : undefined;
}

/** "Lapu-Lapu" -> "Lapu-Lapu City"; names that already say city are kept. */
function cityName(raw: string) {
  return /\bcity\b/i.test(raw) ? raw : `${raw} City`;
}

function spotOf(name: unknown, lat: unknown, lon: unknown): Spot | null {
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (typeof name !== "string" || !name.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { name: name.trim(), latitude, longitude };
}

/**
 * The text shown: at a named place, that name with the barangay and city
 * ("Babag Barangay Hall, Brgy. Babag, Lapu-Lapu City"); elsewhere the street
 * with the barangay and city. The province is left out (it is always the same
 * region and made the line too long); it is still kept in the details.
 */
function labelOf(place: Pick<Place, "name" | "road" | "barangay" | "city" | "province">) {
  const parts = place.name ? [place.name, place.barangay, place.city] : [place.road, place.barangay, place.city];
  const shown = parts.filter((part, index, all): part is string => Boolean(part) && all.indexOf(part) === index);
  // Only a province known: better than nothing.
  if (!shown.length && place.province) shown.push(place.province);
  return shown.join(", ");
}

/**
 * The cell's place as seen from the child's exact point: the named place the
 * child is at (nearest spot within AT_PLACE_M) becomes the name, the nearest
 * other one within LANDMARK_M the "Near …" landmark, with its distance from
 * this point. Places from older saved rows (no spots) are returned unchanged.
 */
export function placeAt(place: Place | null | undefined, latitude: number | null | undefined, longitude: number | null | undefined) {
  if (!place || latitude == null || longitude == null || !place.spots) return place;
  // The place can be in a neighbouring cell's list (2026-11-15: back at the
  // hall from another side, the name did not show): use all nine cells.
  const ranked = spotsAround(latitude, longitude, place.spots)
    .map((spot) => ({ spot, distance: metersBetween(latitude, longitude, spot.latitude, spot.longitude) }))
    .sort((first, second) => first.distance - second.distance);
  const at = ranked[0] && ranked[0].distance <= AT_PLACE_M ? ranked[0].spot : null;
  const other = ranked.find((entry) => entry.spot !== at && entry.distance <= LANDMARK_M);
  const seen: Place = {
    ...place,
    name: at?.name,
    landmark: other ? { name: other.spot.name, distanceMeters: Math.round(other.distance) } : place.landmark === null ? null : undefined,
  };
  return { ...seen, label: place.water && !labelOf(seen) ? place.label : labelOf(seen) };
}

const NEIGHBOURS = [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

/** The cell's own spots plus those known for the eight cells around it. */
function spotsAround(latitude: number, longitude: number, own: Spot[]) {
  const row = Math.floor(latitude * 2000);
  const column = Math.floor(longitude * 2000);
  const all = [...own];
  for (const [dRow, dColumn] of NEIGHBOURS) {
    for (const spot of memory.get(`${row + dRow}:${column + dColumn}`)?.spots ?? []) {
      if (!all.some((known) => known.name === spot.name && known.latitude === spot.latitude)) all.push(spot);
    }
  }
  return all;
}

/** The nine cells whose places can name this point. */
export function cellsAround(latitude: number, longitude: number) {
  const row = Math.floor(latitude * 2000);
  const column = Math.floor(longitude * 2000);
  return new Set(NEIGHBOURS.map(([dRow, dColumn]) => `${row + dRow}:${column + dColumn}`));
}

function addSpots(place: Place, found: (Spot | null)[]) {
  const spots = [...(place.spots ?? [])];
  for (const spot of found) {
    if (spot && !spots.some((known) => known.name === spot.name && metersBetween(known.latitude, known.longitude, spot.latitude, spot.longitude) < 15)) {
      spots.push(spot);
    }
  }
  return { ...place, spots: spots.slice(-12) };
}

type MapboxAddress = { road?: string; barangay?: string; city?: string; province?: string };

/**
 * Street, barangay and city from Mapbox (Geocoding v6, inside the free
 * monthly allowance), used only where OpenStreetMap has no street. Null when
 * there is no token, no answer within 4 s, or any error. Mapbox's terms do not
 * allow storing these results, so they are never written to location_places.
 */
async function mapboxAddress(latitude: number, longitude: number): Promise<MapboxAddress | null> {
  const token = (process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "").trim();
  if (!token) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MAPBOX_TIMEOUT_MS);
  try {
    const params = new URLSearchParams({ longitude: String(longitude), latitude: String(latitude), language: "en", access_token: token });
    const response = await fetch(`${MAPBOX_REVERSE}?${params}`, { signal: controller.signal });
    if (!response.ok) return null;
    const json = (await response.json()) as { features?: { properties?: { context?: Record<string, { name?: string } | undefined> } }[] };
    const context = json.features?.[0]?.properties?.context;
    if (!context) return null;
    return {
      road: context.street?.name,
      barangay: context.locality?.name ?? context.neighborhood?.name,
      city: context.place?.name,
      province: context.region?.name,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Adds Mapbox's street to what OpenStreetMap knows; OpenStreetMap's own parts win. */
export function withMapboxStreet(place: Place | null, found: MapboxAddress | null): Place | null {
  if (!found?.road) return place;
  const barangay = place?.barangay ?? barangayName(found.barangay);
  const city = place?.city ?? found.city;
  const province = place?.province ?? found.province;
  const merged: Place = { spots: [], v: PLACE_VERSION, ...(place ?? {}), label: "", road: found.road, barangay, city, province, mapbox: true };
  return { ...merged, label: labelOf(merged) };
}

async function lookUp(latitude: number, longitude: number): Promise<Place | null> {
  const cell = placeCell(latitude, longitude);

  const { data } = await supabase
    .from("location_places")
    .select("label, details")
    .eq("cell", cell)
    .maybeSingle()
    .then(
      (result) => result,
      () => ({ data: null }),
    );
  // Rows saved before the exact-spot names (no version) are looked up again and replaced.
  if (data?.label && (data.details as Place | null)?.v === PLACE_VERSION) return { ...(data.details as Place), label: String(data.label) };

  const address = await nominatim(latitude, longitude);
  let place = toPlace(address, latitude, longitude);
  // OpenStreetMap has no street here (common inside subdivisions): ask Mapbox.
  if (!place || (!place.road && !place.water)) place = withMapboxStreet(place, await mapboxAddress(latitude, longitude));
  if (!place) return null;

  // Shown now; nearby named places are added below and saved with it.
  void addLandmark(cell, latitude, longitude, place);
  return place;
}

/** Saves the cell's place (OpenStreetMap only; Mapbox results may not be stored). */
function save(latitude: number, longitude: number, place: Place) {
  if (place.mapbox) return;
  const { label: _label, near: _near, landmark: _landmark, name: _name, ...details } = place;
  const label = placeAt(place, latitude, longitude)?.label || place.label;
  if (!label) return;
  void supabase
    .rpc("save_location_place", { p_latitude: latitude, p_longitude: longitude, p_label: label, p_details: details })
    .then(
      () => undefined,
      () => undefined,
    );
}

async function poiAt(latitude: number, longitude: number): Promise<Spot | null> {
  const poi = await nominatim(latitude, longitude, "poi,manmade");
  const spot = spotOf(poi.name, poi.lat, poi.lon);
  return spot && metersBetween(latitude, longitude, spot.latitude, spot.longitude) <= LANDMARK_M ? spot : null;
}

/** The nearest named place (shop, school, church...) within ~400 m, then saved. */
async function addLandmark(cell: string, latitude: number, longitude: number, place: Place) {
  let complete: Place = { ...place };
  try {
    complete = addSpots(complete, [await poiAt(latitude, longitude)]);
  } catch {
    complete.landmark = null;
  }
  remember(cell, complete);
  save(latitude, longitude, complete);
}

/** ~11 m squares whose exact point was already checked for a named place. */
const checkedSpots = new Set<string>();

/**
 * When the child is not at any named place known for the cell, the exact
 * point is asked once (per ~11 m square): the cell was looked up from another
 * point up to ~55 m away, whose nearest place can be a different one.
 */
async function spotsNear(latitude: number, longitude: number) {
  const cell = placeCell(latitude, longitude);
  const place = memory.get(cell);
  if (!place?.spots || place.water) return;
  if (spotsAround(latitude, longitude, place.spots).some((spot) => metersBetween(latitude, longitude, spot.latitude, spot.longitude) <= AT_PLACE_M)) return;
  const fine = `${Math.floor(latitude * 10_000)}:${Math.floor(longitude * 10_000)}`;
  if (checkedSpots.has(fine)) return;
  checkedSpots.add(fine);
  try {
    const spot = await poiAt(latitude, longitude);
    const current = memory.get(cell);
    if (!spot || !current?.spots) return;
    const updated = addSpots(current, [spot]);
    if (updated.spots!.length === current.spots.length) return;
    remember(cell, updated);
    save(latitude, longitude, updated);
  } catch {
    checkedSpots.delete(fine); // retried next time
  }
}

/** The place for a point, or null when no address is known. Never throws. */
export async function placeFor(latitude: number | null | undefined, longitude: number | null | undefined): Promise<Place | null> {
  if (latitude == null || longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return placeAt(await cellPlace(latitude, longitude), latitude, longitude) ?? null;
}

/** The cell's place (all its named places), looked up once. */
async function cellPlace(latitude: number, longitude: number): Promise<Place | null> {
  const cell = placeCell(latitude, longitude);
  if (memory.has(cell)) return memory.get(cell) ?? null;
  const inFlight = pending.get(cell);
  if (inFlight) return inFlight;

  const request = lookUp(latitude, longitude)
    .then((place) => {
      remember(cell, place);
      return place;
    })
    .catch(() => null) // a failed lookup is retried next time
    .finally(() => pending.delete(cell));
  pending.set(cell, request);
  return request;
}

/**
 * Where the child is now: also checks the exact point for a named place the
 * cell does not know yet (the answer arrives through onPlaceChange).
 */
export function checkSpot(latitude: number | null | undefined, longitude: number | null | undefined) {
  if (latitude == null || longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
  void spotsNear(latitude, longitude);
}

/** Already-known place, without a network request. */
export function cachedPlace(latitude: number | null | undefined, longitude: number | null | undefined) {
  if (latitude == null || longitude == null) return undefined;
  const cell = placeCell(latitude, longitude);
  return memory.has(cell) ? placeAt(memory.get(cell), latitude, longitude) ?? null : undefined;
}

/**
 * A known place in one of the eight cells around this point (about 55-110 m
 * away), marked `near`, to show while the point's own cell is looked up.
 */
export function nearbyPlace(latitude: number | null | undefined, longitude: number | null | undefined): Place | null {
  if (latitude == null || longitude == null) return null;
  const row = Math.floor(latitude * 2000);
  const column = Math.floor(longitude * 2000);
  for (const [dRow, dColumn] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const place = memory.get(`${row + dRow}:${column + dColumn}`);
    if (place?.label) return { ...placeAt(place, latitude, longitude)!, near: true, landmark: null };
  }
  return null;
}

/**
 * Looks up the cell about 60 m ahead of a moving child, so its address is
 * ready when they get there. Only when no other lookup is waiting (the
 * one-per-second limit is shared). Never throws.
 */
export function prefetchAhead(latitude: number, longitude: number, headingDegrees: number | null | undefined, speedMps: number | null | undefined) {
  if (headingDegrees == null || !Number.isFinite(headingDegrees) || (speedMps ?? 0) < 0.6 || pending.size > 0) return;
  const radians = (headingDegrees * Math.PI) / 180;
  const ahead = 60;
  const aheadLat = latitude + (ahead * Math.cos(radians)) / 111_320;
  const aheadLng = longitude + (ahead * Math.sin(radians)) / (111_320 * Math.cos((latitude * Math.PI) / 180));
  if (memory.has(placeCell(aheadLat, aheadLng))) return;
  void cellPlace(aheadLat, aheadLng);
}
