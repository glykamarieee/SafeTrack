// Types shared by every SafeTrack map engine: react-native-maps on Android and
// iOS, and the Google Maps JavaScript API (or the Leaflet fallback) on web.

import type { TravelMode } from "../../types/safetrack";
import type { BearingStore } from "./mapBearing";

export type MarkerKind =
  | "child"
  | "guardian"
  | "replay"
  | "start"
  | "end"
  | "stop"
  | "event"
  | "zoneCenter"
  | "draft"
  | "sos"
  | "location";

/** Ring colour of an avatar marker. */
export type AvatarRing = "inside" | "outside" | "sos" | "stale" | "neutral";

export type MapMarker = {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  detail?: string;
  kind?: MarkerKind;
  /** Avatar markers: initials shown when there is no photo. */
  initials?: string;
  /** Avatar markers: signed photo URL. */
  photoUrl?: string | null;
  /** Stable cache key for the photo (its storage path); signed URLs change. */
  photoKey?: string | null;
  /** Avatar markers: background colour behind the initials. */
  color?: string;
  ring?: AvatarRing;
  /** Freshness of the real last update: under 15 min, under 2 h, older. */
  status?: "fresh" | "stale" | "old";
  /** Which device reported the location. */
  source?: "smartwatch" | "mobile" | null;
  /** The watch's current battery, when known. */
  batteryPercent?: number | null;
  networkType?: string | null;
  /** GPS accuracy, drawn as a translucent circle. */
  accuracyMeters?: number | null;
  /** Small text under an avatar ("You") or inside a stop pin ("3"). */
  label?: string;
  /** Event pins: colour and Ionicons glyph name. */
  tint?: string;
  icon?: string;
  recordedAt?: string | null;
  /** Horizontal pixel offset so overlapping avatars stay visible. */
  offsetX?: number;
  /** Child avatar: how the child is moving, shown as a small badge. */
  mode?: TravelMode | null;
  /**
   * Child and guardian avatars: the direction the person faces (0 = north,
   * clockwise), drawn as an arrow and a soft view cone. Null hides them.
   */
  headingDegrees?: number | null;
};

/**
 * One footprint behind a walking or running child: a left or right foot
 * facing the direction of travel. Opacity fades with age; `fresh` prints
 * (just stepped) get a short press-in animation.
 */
export type MapFootprint = {
  id: string;
  latitude: number;
  longitude: number;
  heading: number;
  opacity: number;
  foot: "left" | "right";
  gait: "walk" | "run";
  fresh: boolean;
};

export type ZoneStatus = "inside" | "outside" | "active" | "inactive" | "draft" | "accuracy";

export type MapCircle = {
  id: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  label?: string;
  /** Legacy flag; `status` wins when both are given. */
  enabled?: boolean;
  status?: ZoneStatus;
  /** Shows an "Edit zone" action when the zone is tapped. */
  editable?: boolean;
  /** Latest server entry/exit time for this zone, if any. */
  lastEventType?: "entry" | "exit" | null;
  lastEventAt?: string | null;
};

export type MapPoint = {
  latitude: number;
  longitude: number;
  /** Route only: the stretch from this point to the next is an unknown path
   * (no road could be matched); it is drawn dashed, not as a solid road line. */
  gapAfter?: boolean;
};

/** `bearing`: the map's rotation, degrees clockwise from north (0 = north up). */
export type MapView = { latitude: number; longitude: number; zoom: number; bearing?: number };

export type MapPadding = { top: number; right: number; bottom: number; left: number };

export type BaseMapType = "standard" | "satellite" | "terrain";

export type MapTheme = "light" | "dark" | "auto";

export type MapPrefs = {
  mapType: BaseMapType;
  /** Satellite only: show road and place labels (hybrid). */
  labels: boolean;
  traffic: boolean;
  zones: boolean;
  route: boolean;
  theme: MapTheme;
};

export const DEFAULT_PREFS: MapPrefs = {
  mapType: "standard",
  labels: true,
  traffic: false,
  zones: true,
  route: true,
  // Auto follows the app's Light / Dark appearance.
  theme: "auto",
};

/** Default view when nothing is known yet: Metro Manila. */
export const DEFAULT_VIEW: MapView = { latitude: 14.5995, longitude: 120.9842, zoom: 11 };

export const MIN_ZOOM = 3;
export const MAX_ZOOM = 20;

export const ZONE_COLORS: Record<ZoneStatus, string> = {
  inside: "#22B35E",
  active: "#22B35E",
  outside: "#F5B83D",
  inactive: "#8C948F",
  draft: "#245E9C",
  accuracy: "#22B35E",
};

export const RING_COLORS: Record<AvatarRing, string> = {
  inside: "#22B35E",
  outside: "#F5B83D",
  sos: "#B42318",
  stale: "#8C948F",
  neutral: "#15803D",
};

/** What every engine draws and reports; the controls live in the shell. */
export type MapEngineProps = {
  markers: MapMarker[];
  circles: MapCircle[];
  path: MapPoint[];
  /** Live map only; engines without support ignore them. */
  footprints?: MapFootprint[];
  prefs: MapPrefs;
  dark: boolean;
  /** Space covered by overlays, kept clear when fitting content. */
  fitPadding: MapPadding;
  /** Native: insets that keep the Google logo and the camera clear of overlays. */
  mapPadding: MapPadding;
  picking: boolean;
  initialView?: MapView | null;
  /** Engines that rotate report their bearing here (mapBearing.ts). */
  bearing?: BearingStore;
  onReady(): void;
  onError(message: string): void;
  onPress(point: MapPoint): void;
  onMarkerPress(id: string): void;
  onViewChange(view: MapView): void;
};

export type MapEngineHandle = {
  /** Fit all content (markers, zones and route). */
  fit(animated: boolean): void;
  focus(target: MapPoint & { radiusMeters?: number; zoom?: number }): void;
  /** Zoom in or out by whole levels; repeated presses queue up. */
  zoomBy(delta: number): void;
  /** Turn the map back to north up (after the guardian rotated it). */
  resetNorth(): void;
};

export function clampZoom(zoom: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** Points that bound a circle, for fitting the camera to it. */
export function circleBounds(circle: { latitude: number; longitude: number; radiusMeters: number }): MapPoint[] {
  const latDelta = circle.radiusMeters / 111_320;
  const lngDelta = circle.radiusMeters / (111_320 * Math.max(0.2, Math.cos((circle.latitude * Math.PI) / 180)));

  return [
    { latitude: circle.latitude + latDelta, longitude: circle.longitude },
    { latitude: circle.latitude - latDelta, longitude: circle.longitude },
    { latitude: circle.latitude, longitude: circle.longitude + lngDelta },
    { latitude: circle.latitude, longitude: circle.longitude - lngDelta },
  ];
}

/** A circle as a closed polygon ring of [longitude, latitude] pairs (GeoJSON order). */
export function circleRing(circle: { latitude: number; longitude: number; radiusMeters: number }, steps = 64) {
  const latRadius = circle.radiusMeters / 111_320;
  const lngRadius = circle.radiusMeters / (111_320 * Math.max(0.01, Math.cos((circle.latitude * Math.PI) / 180)));
  const ring: [number, number][] = [];

  for (let index = 0; index <= steps; index += 1) {
    const angle = (index / steps) * 2 * Math.PI;
    ring.push([circle.longitude + lngRadius * Math.cos(angle), circle.latitude + latRadius * Math.sin(angle)]);
  }

  return ring;
}

/**
 * Splits a route into road pieces (solid green) and unknown stretches
 * (dashed grey), using each point's `gapAfter`.
 */
export function splitRoute(path: MapPoint[]): { pieces: MapPoint[][]; gaps: MapPoint[][] } {
  const pieces: MapPoint[][] = [];
  const gaps: MapPoint[][] = [];
  let current: MapPoint[] = [];
  for (let index = 0; index < path.length; index += 1) {
    const point = path[index]!;
    current.push(point);
    const next = path[index + 1];
    if (point.gapAfter && next) {
      if (current.length > 1) pieces.push(current);
      gaps.push([point, next]);
      current = [];
    }
  }
  if (current.length > 1) pieces.push(current);
  return { pieces, gaps };
}

/** Everything the camera should show when fitting: markers, zones and the route. */
export function contentPoints(markers: MapMarker[], circles: MapCircle[], path: MapPoint[]): MapPoint[] {
  return [
    ...markers.filter((marker) => marker.kind !== "replay"),
    ...circles.filter((circle) => circle.status !== "accuracy").flatMap(circleBounds),
    ...path,
  ].map(({ latitude, longitude }) => ({ latitude, longitude }));
}

export function distanceMeters(first: MapPoint, second: MapPoint) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(second.latitude - first.latitude);
  const dLng = radians(second.longitude - first.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude)) * Math.sin(dLng / 2) ** 2;

  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function initialsOf(name?: string | null) {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);

  return parts.slice(0, 2).map((part) => part[0]!.toUpperCase()).join("") || "?";
}

const AVATAR_COLORS = ["#15803D", "#0D2A1E", "#178A43", "#1F5C3F", "#2C7A52"];

/** A stable colour for someone's initials. */
export function colorFor(seed?: string | null) {
  const text = String(seed ?? "");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index)) | 0;

  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

export function minutesSince(value?: string | null) {
  const time = value ? Date.parse(value) : NaN;

  return Number.isFinite(time) ? Math.max(0, (Date.now() - time) / 60000) : Infinity;
}

export function freshness(value?: string | null): "fresh" | "stale" | "old" {
  const minutes = minutesSince(value);

  return minutes < 15 ? "fresh" : minutes < 120 ? "stale" : "old";
}

export function lastSeenLabel(value?: string | null) {
  const minutes = minutesSince(value);
  if (!Number.isFinite(minutes)) return "No update yet";
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Last seen ${Math.floor(minutes)} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last seen ${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `Last seen ${days} day${days === 1 ? "" : "s"} ago`;
}

/**
 * Avatars that would sit exactly on top of each other stay readable: the
 * child is always drawn at its true position; only the guardian's own avatar
 * ("You") is nudged a little to the side, overlapping, so the two read as
 * "together" instead of being pushed apart (the old rule moved both by 17 px,
 * which looked like two separate places).
 */
export function spreadOverlapping(markers: MapMarker[], thresholdMeters = 35): MapMarker[] {
  const children = markers.filter((marker) => marker.kind === "child");
  const guardians = markers.filter((marker) => marker.kind === "guardian");
  if (!children.length || !guardians.length) return markers;

  const offsets = new Map<string, number>();
  guardians.forEach((guardian) => {
    if (children.some((child) => distanceMeters(child, guardian) < thresholdMeters)) offsets.set(guardian.id, -26);
  });

  if (!offsets.size) return markers;

  return markers.map((marker) => (offsets.has(marker.id) ? { ...marker, offsetX: offsets.get(marker.id) } : marker));
}

/** Google Maps directions to a point, in the app or the browser. */
export function directionsUrl(point: MapPoint) {
  return `https://www.google.com/maps/dir/?api=1&destination=${point.latitude},${point.longitude}`;
}

export function zoomFromRegion(longitudeDelta: number, widthPx: number) {
  // 256 px tiles: the world is 256 * 2^zoom px wide.
  return Math.log2((360 * (widthPx / 256)) / Math.max(1e-9, longitudeDelta));
}
