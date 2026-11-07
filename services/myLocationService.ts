import { AppState, Platform } from "react-native";
import * as Location from "expo-location";
import { create } from "zustand";

import { testLog } from "../lib/testLog";

/**
 * The guardian's own position and the direction their phone faces, kept live
 * while a map that shows "You" is on screen (2026-11-08).
 *
 * Before, the map used the phone's last known position once, which could be
 * minutes or hours old: a guardian standing next to the child could appear far
 * away. Now GPS updates about every second and the compass a few times a
 * second, only while the app is in front and a map is mounted.
 */

export type MyPosition = {
  latitude: number;
  longitude: number;
  accuracy: number;
  at: number;
  speedMps: number | null;
  /** GPS direction of travel, only while moving. */
  courseDegrees: number | null;
};

type MyLocationState = {
  me: MyPosition | null;
  /** Compass heading, 0 = north, clockwise; null without a compass. */
  heading: number | null;
  /** Location access granted (the map then shows "You" without asking). */
  granted: boolean;
};

export const useMyLocation = create<MyLocationState>(() => ({ me: null, heading: null, granted: false }));

/** A last known position older than this is not shown (it may be far from here). */
const LAST_KNOWN_MAX_AGE_MS = 2 * 60_000;
/** Compass changes smaller than this are not worth a map update. */
const HEADING_STEP = 3;

let users = 0;
let position: Location.LocationSubscription | null = null;
let compass: Location.LocationSubscription | null = null;
let starting = false;

async function start() {
  if (starting || position) return;
  starting = true;
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    useMyLocation.setState({ granted: permission.granted });
    if (!permission.granted || users === 0) return;

    const known = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS }).catch(() => null);
    if (known && !useMyLocation.getState().me) apply(known);

    const next = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
      apply,
    );
    // Closed while starting.
    if (users === 0 || AppState.currentState !== "active") next.remove();
    else position = next;

    if (Platform.OS !== "web" && position && !compass) {
      compass = await Location.watchHeadingAsync((value) => {
        const raw = value.trueHeading >= 0 ? value.trueHeading : value.magHeading;
        // accuracy 0 = the compass needs calibrating: not trusted.
        if (!Number.isFinite(raw) || raw < 0 || value.accuracy === 0) return;
        const current = useMyLocation.getState().heading;
        if (current != null && Math.abs(((raw - current + 540) % 360) - 180) < HEADING_STEP) return;
        useMyLocation.setState({ heading: Math.round(raw) % 360 });
      }).catch(() => null);
    }
  } catch (reason) {
    console.log("[my location]", (reason as { message?: string })?.message ?? reason);
  } finally {
    starting = false;
  }
}

function apply(fix: Location.LocationObject) {
  const speed = fix.coords.speed != null && fix.coords.speed >= 0 ? fix.coords.speed : null;
  const course = speed != null && speed >= 0.8 && fix.coords.heading != null && fix.coords.heading >= 0 ? fix.coords.heading : null;
  const me: MyPosition = {
    latitude: fix.coords.latitude,
    longitude: fix.coords.longitude,
    accuracy: fix.coords.accuracy ?? 0,
    at: fix.timestamp,
    speedMps: speed,
    courseDegrees: course,
  };
  useMyLocation.setState({ me, granted: true });
  testLog("me", { acc: Math.round(me.accuracy), spd: speed, crs: course, hd: useMyLocation.getState().heading });
}

function stop() {
  position?.remove();
  compass?.remove();
  position = null;
  compass = null;
}

AppState.addEventListener("change", (state) => {
  if (state === "active" && users > 0) void start();
  else if (state !== "active") stop();
});

/** Keep the guardian's position live while the returned function is not called. */
export function watchMyLocation(): () => void {
  users += 1;
  void start();
  return () => {
    users = Math.max(0, users - 1);
    if (users === 0) stop();
  };
}

/** After the guardian granted access (the "My location" button). */
export function restartMyLocation() {
  stop();
  void start();
}

/** Which way the guardian faces: GPS course while walking, else the compass. */
export function myFacing(state: Pick<MyLocationState, "me" | "heading">): number | null {
  return state.me?.courseDegrees ?? state.heading;
}
