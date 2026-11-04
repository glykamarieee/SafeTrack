import { useEffect, useMemo, useState } from "react";

import { cachedPlace, placeFor, type Place } from "../lib/places";
import { describeMotion, isLive } from "../lib/travelMode";
import type { MapCircle } from "../components/location/mapTypes";
import type { LocationLog, TravelMode } from "../types/safetrack";

function meters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLng = radians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function distanceText(value: number) {
  return value < 1000 ? `${Math.round(value / 10) * 10} m` : `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)} km`;
}

function durationText(ms: number) {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`;
}

/** Address lookup for one point; `undefined` while loading, `null` when none. */
export function usePlace(latitude: number | null | undefined, longitude: number | null | undefined) {
  const [place, setPlace] = useState<Place | null | undefined>(() => cachedPlace(latitude, longitude));

  useEffect(() => {
    let active = true;
    const known = cachedPlace(latitude, longitude);
    setPlace(known);
    if (known === undefined) {
      void placeFor(latitude, longitude).then((value) => active && setPlace(value));
    }
    return () => {
      active = false;
    };
  }, [latitude, longitude]);

  return place;
}

export type PlaceDetails = {
  place: Place | null | undefined;
  motion: ReturnType<typeof describeMotion>;
  /** "Inside School" / "120 m from Home" / null without zones. */
  zone: string | null;
  inside: boolean;
  /** "Here for 12 min", from recent points within 60 m. */
  stay: string | null;
  live: boolean;
};

/**
 * Everything the guardian is shown about where the child is: address,
 * landmark, how they are moving, the nearest safe zone and how long they have
 * been there. `history` is newest first (the location store's order).
 */
export function usePlaceDetails(location: LocationLog | null | undefined, history: LocationLog[], zones: MapCircle[]): PlaceDetails {
  const place = usePlace(location?.latitude, location?.longitude);
  const [now, setNow] = useState(Date.now());

  // The "Live" badge must drop to "Updated X ago" on its own.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);

  return useMemo(() => {
    if (!location) return { place, motion: null, zone: null, inside: false, stay: null, live: false };


    let zone: string | null = null;
    let inside = false;
    const enabled = zones.filter((circle) => circle.status !== "inactive" && circle.status !== "draft" && circle.status !== "accuracy" && circle.enabled !== false);
    let best: { label: string; edge: number } | null = null;
    for (const circle of enabled) {
      const edge = meters(location, circle) - circle.radiusMeters;
      if (!best || edge < best.edge) best = { label: circle.label ?? "a safe zone", edge };
    }
    if (best) {
      inside = best.edge <= 0;
      zone = inside ? `Inside ${best.label}` : `${distanceText(best.edge)} from ${best.label}`;
    }

    let stay: string | null = null;
    const latestTime = Date.parse(location.recordedAt);
    let earliest = latestTime;
    for (const point of history) {
      if (point.id === location.id) continue;
      if (Date.parse(point.recordedAt) > latestTime) continue;
      // Indoor fixes wander by their accuracy; that is not leaving the place.
      if (meters(point, location) > Math.max(60, location.accuracyMeters ?? 0)) break;
      earliest = Date.parse(point.recordedAt);
    }
    if (latestTime - earliest >= 2 * 60_000) stay = `Here for ${durationText(latestTime - earliest)}`;

    let mode = (location.travelMode ?? null) as TravelMode | null;
    // No speed (Wi-Fi/cell fixes indoors) but several minutes at one spot: still.
    if ((!mode || mode === "unknown") && stay) mode = "still";
    // A vehicle-speed point over water is a boat.
    if (place?.water && mode && mode !== "still" && (location.speedMps ?? 0) > 1.5) mode = "boat";
    const motion = describeMotion(mode, location.speedMps, location.modeConfidence);

    return { place, motion, zone, inside, stay, live: isLive(location.recordedAt, now) };
  }, [location, history, zones, place, now]);
}
