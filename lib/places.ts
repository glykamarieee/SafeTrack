import { supabase } from "./supabase";

/**
 * Street address and nearest landmark for a point, from OpenStreetMap
 * (Nominatim, free; results may be stored under the ODbL, and screens show
 * "© OpenStreetMap contributors").
 *
 * Nominatim's usage policy allows at most one request per second and asks
 * that results are cached, so:
 *  - points are grouped into ~55 m cells (the same cell as location_cell() in
 *    migration 20261104);
 *  - each cell is looked up once: memory, then the shared location_places
 *    table, then Nominatim, and the result is saved back;
 *  - requests queue one second apart.
 * Before the migration runs the database steps fail quietly and only the
 * memory cache is used.
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
};

const NOMINATIM = "https://nominatim.openstreetmap.org/reverse";
const MIN_GAP_MS = 1100;

export function placeCell(latitude: number, longitude: number) {
  return `${Math.floor(latitude * 2000)}:${Math.floor(longitude * 2000)}`;
}

const memory = new Map<string, Place | null>();
const pending = new Map<string, Promise<Place | null>>();
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
  const place = toPlace(address);
  if (!place) return null;

  // The nearest named place (shop, school, church...) within ~400 m.
  try {
    const poi = await nominatim(latitude, longitude, "poi,manmade");
    const poiName = typeof poi.name === "string" ? poi.name.trim() : "";
    if (poiName && poi.lat && poi.lon) {
      const distance = metersBetween(latitude, longitude, Number(poi.lat), Number(poi.lon));
      if (distance <= 400) place.landmark = { name: poiName, distanceMeters: Math.round(distance) };
    }
  } catch {
    place.landmark = null;
  }

  if (place.label) {
    const { label, ...details } = place;
    void supabase
      .rpc("save_location_place", { p_latitude: latitude, p_longitude: longitude, p_label: label, p_details: details })
      .then(
        () => undefined,
        () => undefined,
      );
  }
  return place;
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
      memory.set(cell, place);
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
