// Types shared by every SafeTrack map engine: react-native-maps on Android and
// iOS, and the Google Maps JavaScript API (or the Leaflet fallback) on web.

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

export type MapPoint = { latitude: number; longitude: number };

export type MapView = { latitude: number; longitude: number; zoom: number };

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
  theme: "light",
};

/** Default view when nothing is known yet: Metro Manila. */
export const DEFAULT_VIEW: MapView = { latitude: 14.5995, longitude: 120.9842, zoom: 11 };

export const MIN_ZOOM = 3;
export const MAX_ZOOM = 20;

export const ZONE_COLORS: Record<ZoneStatus, string> = {
  inside: "#1E8E5A",
  active: "#1E8E5A",
  outside: "#D93025",
  inactive: "#8A9690",
  draft: "#1E4FD8",
  accuracy: "#1A73E8",
};

export const RING_COLORS: Record<AvatarRing, string> = {
  inside: "#1E8E5A",
  outside: "#E8A317",
  sos: "#D93025",
  stale: "#8A9690",
  neutral: "#137A50",
};

/** What every engine draws and reports; the controls live in the shell. */
export type MapEngineProps = {
  markers: MapMarker[];
  circles: MapCircle[];
  path: MapPoint[];
  prefs: MapPrefs;
  dark: boolean;
  /** Space covered by overlays, kept clear when fitting content. */
  fitPadding: MapPadding;
  /** Native: insets that keep the Google logo and the camera clear of overlays. */
  mapPadding: MapPadding;
  picking: boolean;
  initialView?: MapView | null;
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

const AVATAR_COLORS = ["#137A50", "#1A73E8", "#8E44AD", "#C2410C", "#0E7490", "#B45309", "#BE185D"];

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

/** Spread avatar markers that would sit on top of each other. */
export function spreadOverlapping(markers: MapMarker[], thresholdMeters = 35): MapMarker[] {
  const avatars = markers.filter((marker) => marker.kind === "child" || marker.kind === "guardian");
  if (avatars.length < 2) return markers;

  const groups: MapMarker[][] = [];
  avatars.forEach((marker) => {
    const group = groups.find((items) => distanceMeters(items[0]!, marker) < thresholdMeters);
    if (group) group.push(marker);
    else groups.push([marker]);
  });

  const offsets = new Map<string, number>();
  groups.forEach((group) => {
    if (group.length < 2) return;
    group.forEach((marker, index) => offsets.set(marker.id, (index - (group.length - 1) / 2) * 34));
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
