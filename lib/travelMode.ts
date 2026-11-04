import type { TravelMode } from "../types/safetrack";

/**
 * How the child is moving, from GPS speed. The watch uses the same speed
 * bands plus Android Activity Recognition (LocationTracker.kt).
 *
 * GPS speed cannot tell a car from a jeep, or a motorcycle from a car, so any
 * vehicle speed is "vehicle". Running and biking overlap around 2–3.5 m/s,
 * so confidence is lower there. "boat" is only set on the guardian side, when
 * the point is over water (lib/places.ts).
 */
export const SPEED_BANDS = {
  still: 0.6, // below: standing or sitting (GPS drift is ~0.3–0.5 m/s)
  walking: 2.2, // ~8 km/h
  running: 3.5, // ~12.6 km/h; running and slow biking overlap up to here
  biking: 7, // ~25 km/h; faster is a vehicle
} as const;

export type MotionEstimate = { mode: TravelMode; confidence: number };

/** Speed in m/s (null when the device gave none) -> mode and 0–1 confidence. */
export function classifySpeed(speedMps: number | null | undefined, accuracyMeters?: number | null): MotionEstimate {
  if (speedMps == null || !Number.isFinite(speedMps) || speedMps < 0) return { mode: "unknown", confidence: 0 };
  // A poor fix makes the speed unreliable.
  const quality = accuracyMeters == null ? 0.8 : accuracyMeters <= 20 ? 1 : accuracyMeters <= 50 ? 0.7 : 0.4;
  if (speedMps < SPEED_BANDS.still) return { mode: "still", confidence: 0.9 * quality };
  if (speedMps < SPEED_BANDS.walking) return { mode: "walking", confidence: 0.8 * quality };
  if (speedMps < SPEED_BANDS.running) return { mode: "running", confidence: 0.5 * quality };
  if (speedMps < SPEED_BANDS.biking) return { mode: "biking", confidence: 0.5 * quality };
  return { mode: "vehicle", confidence: 0.8 * quality };
}

/** Speed between two fixes, for devices that report no speed. */
export function speedBetween(
  a: { latitude: number; longitude: number; time: number },
  b: { latitude: number; longitude: number; time: number },
) {
  const seconds = (b.time - a.time) / 1000;
  if (seconds < 3) return null;
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLng = radians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return (6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))) / seconds;
}

const LABELS: Record<TravelMode, string> = {
  still: "Staying still",
  walking: "Walking",
  running: "Running",
  biking: "Biking",
  vehicle: "In a vehicle",
  boat: "On a boat",
  unknown: "Moving",
};

const ICONS: Record<TravelMode, string> = {
  still: "pause-circle-outline",
  walking: "walk-outline",
  running: "walk-outline",
  biking: "bicycle-outline",
  vehicle: "car-outline",
  boat: "boat-outline",
  unknown: "navigate-outline",
};

/**
 * "Walking · 4 km/h", "Running or biking · 11 km/h (likely)",
 * "In a vehicle · 38 km/h (car, jeep or motorcycle)".
 */
export function describeMotion(mode: TravelMode | null | undefined, speedMps?: number | null, confidence?: number | null) {
  if (!mode) return null;
  const kmh = speedMps != null && Number.isFinite(speedMps) ? Math.round(speedMps * 3.6) : null;
  const unsure = confidence != null && confidence < 0.5;
  let label = LABELS[mode];
  if (unsure && (mode === "running" || mode === "biking")) label = "Running or biking";
  const speed = kmh != null && mode !== "still" ? ` · ${kmh} km/h` : "";
  const hint =
    mode === "vehicle" ? " (car, jeep or motorcycle)" : mode === "boat" ? " (over water)" : unsure && mode !== "unknown" ? " (likely)" : "";
  return { label: `${label}${speed}${hint}`, short: label, icon: ICONS[mode], mode, kmh };
}

/** Points younger than this count as live. */
export const LIVE_MAX_AGE_MS = 30_000;

export function isLive(recordedAt: string | null | undefined, now = Date.now()) {
  if (!recordedAt) return false;
  const age = now - Date.parse(recordedAt);
  return age >= -60_000 && age < LIVE_MAX_AGE_MS;
}
