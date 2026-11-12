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
 */
export type Place = {
  /** "Rizal Ave, Brgy. 495, Caloocan City, Metro Manila" */
  label: string;
  name?: string;
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

/** Builds the place from a Nominatim answer; null when there is no address. */
export function toPlace(result: Record<string, any>): Place | null {
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
  const barangay = barangayRaw ? (/^(barangay|brgy)/i.test(barangayRaw) ? barangayRaw : `Brgy. ${barangayRaw}`) : undefined;
  const city = a.city ?? a.town ?? a.municipality ?? a.county;
  const province = a.state ?? a.province ?? a.region;
  const name = typeof result.name === "string" && result.name.trim() && result.name !== a.road ? result.name.trim() : undefined;
  const parts = [name, road, barangay, city, province].filter((part, index, all): part is string => Boolean(part) && all.indexOf(part) === index);
  if (parts.length === 0) return water ? { label: "", water: true } : null;
  return { label: parts.join(", "), name, road, barangay, city, province, water };
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
  const barangay = place?.barangay ?? (found.barangay ? (/^(barangay|brgy)/i.test(found.barangay) ? found.barangay : `Brgy. ${found.barangay}`) : undefined);
  const city = place?.city ?? found.city;
  const province = place?.province ?? found.province;
  const parts = [place?.name, found.road, barangay, city, province].filter((part, index, all): part is string => Boolean(part) && all.indexOf(part) === index);
  return { ...(place ?? {}), label: parts.join(", "), road: found.road, barangay, city, province, mapbox: true };
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
  if (data?.label) return { ...(data.details as Place), label: String(data.label) };

  const address = await nominatim(latitude, longitude);
  let place = toPlace(address);
  // OpenStreetMap has no street here (common inside subdivisions): ask Mapbox.
  if (!place || (!place.road && !place.water)) place = withMapboxStreet(place, await mapboxAddress(latitude, longitude));
  if (!place) return null;

  // Shown now; the landmark is added below and saved with it.
  void addLandmark(cell, latitude, longitude, place);
  return place;
}

/** The nearest named place (shop, school, church...) within ~400 m, then saved. */
async function addLandmark(cell: string, latitude: number, longitude: number, place: Place) {
  const complete: Place = { ...place };
  try {
    const poi = await nominatim(latitude, longitude, "poi,manmade");
    const poiName = typeof poi.name === "string" ? poi.name.trim() : "";
    if (poiName && poi.lat && poi.lon) {
      const distance = metersBetween(latitude, longitude, Number(poi.lat), Number(poi.lon));
      if (distance <= 400) complete.landmark = { name: poiName, distanceMeters: Math.round(distance) };
    }
  } catch {
    complete.landmark = null;
  }
  if (complete.landmark) remember(cell, complete);

  if (complete.label && !complete.mapbox) {
    const { label, near: _near, ...details } = complete;
    void supabase
      .rpc("save_location_place", { p_latitude: latitude, p_longitude: longitude, p_label: label, p_details: details })
      .then(
        () => undefined,
        () => undefined,
      );
  }
}

/** The place for a point, or null when no address is known. Never throws. */
export async function placeFor(latitude: number | null | undefined, longitude: number | null | undefined): Promise<Place | null> {
  if (latitude == null || longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
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

/** Already-known place, without a network request. */
export function cachedPlace(latitude: number | null | undefined, longitude: number | null | undefined) {
  if (latitude == null || longitude == null) return undefined;
  return memory.get(placeCell(latitude, longitude));
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
    if (place?.label) return { ...place, near: true, landmark: null };
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
  void placeFor(aheadLat, aheadLng);
}
