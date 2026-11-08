import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { SPEED_BANDS, classifySpeed, speedBetween } from "../lib/travelMode";
import { supabase } from "../lib/supabase";
import { ChildPhoneUnlinkedError, linkedChildId, pushChildPhoneLive, recordChildPhoneLocation } from "./childMobileService";

/**
 * Optional automatic location sharing for a linked child phone.
 *
 * - Off until the child turns it on (consent), and can be turned off any time.
 * - Android shows a permanent "SafeTrack is sharing location" notification
 *   while it runs (a foreground service), iOS shows the location indicator.
 * - Moving: a location about every 10 seconds (each time it moved 15 m),
 *   with speed and travel mode. Still: one every 3 minutes.
 * - Needs a development or release build; Expo Go and the web cannot run it.
 * - After the phone restarts, sharing resumes the next time SafeTrack is
 *   opened (Android does not restart the service on its own).
 */

export const CHILD_LOCATION_TASK = "safetrack-child-background-location";

const LAST_SENT_KEY = "safetrack.childPhone.lastBackgroundSend";
// Location checks every CHECK_INTERVAL_MS; moving, a record each time it
// moved MOVE_SAVE_M (so the guardian sees the trip as it happens, along the
// real streets); staying still, one record every STILL_SAVE_MS. Same rules as
// the watch. 10 s instead of 5 s roughly halves the extra GPS battery use and
// still looks continuous on the map.
const CHECK_INTERVAL_MS = 10 * 1000;
const MOVE_SAVE_M = 15;
const STILL_SAVE_MS = 3 * 60 * 1000;

// While a guardian has the map open (migration 20261108): a fix every second,
// each sent to the live map (not saved). The guardian's app wakes the phone
// at once (live-wake topic, below); as a fallback the phone also asks whether
// anyone is watching every LIVE_PROBE_MS with the fix it already has.
const LIVE_INTERVAL_MS = 1000;
const LIVE_PROBE_MS = 20 * 1000;
// Live and still: a fix this often keeps the map "Live"; a move of LIVE_MOVE_M
// or a walking speed sends at once.
const LIVE_STILL_MS = 5 * 1000;
// Small: a slow walk often reads as "still", and holding fixes back until 5 m
// showed as a delay on the guardian's map.
const LIVE_MOVE_M = 2;
// Live: turning this much in place is sent at once (the arrow on the map).
const LIVE_TURN_DEG = 20;
// Live: a fix coarser than this is not sent while a sharp one is this recent.
const LIVE_COARSE_M = 50;
const LIVE_SHARP_M = 20;
const LIVE_SHARP_MS = 10 * 1000;
const LIVE_KEY = "safetrack.childPhone.live";

/** probedAt, latitude, longitude, heading, accuracy: the last fix sent to the live map. */
type LiveState = {
  live: boolean;
  probedAt: number;
  latitude?: number;
  longitude?: number;
  heading?: number | null;
  accuracy?: number | null;
};

// The phone's compass while a guardian watches: which way the child faces
// when standing still (GPS gives a direction only while moving).
let compass: Location.LocationSubscription | null = null;
let compassHeading: { degrees: number; at: number } | null = null;

async function setCompass(on: boolean) {
  if (on && !compass) {
    compass = await Location.watchHeadingAsync((value) => {
      const degrees = value.trueHeading >= 0 ? value.trueHeading : value.magHeading;
      if (Number.isFinite(degrees) && degrees >= 0 && value.accuracy !== 0) compassHeading = { degrees, at: Date.now() };
    }).catch(() => null);
  } else if (!on && compass) {
    compass.remove();
    compass = null;
    compassHeading = null;
  }
}

/** GPS direction while walking or running, otherwise the compass (when recent). */
function facing(fix: Location.LocationObject, speed: number | null): number | null {
  if (speed != null && speed >= 1 && fix.coords.heading != null && fix.coords.heading >= 0) return fix.coords.heading;
  if (compassHeading && Date.now() - compassHeading.at < 3000) return Math.round(compassHeading.degrees) % 360;
  return null;
}

const angleBetween = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

async function readLive(): Promise<LiveState> {
  try {
    const raw = await AsyncStorage.getItem(LIVE_KEY);
    return raw ? (JSON.parse(raw) as LiveState) : { live: false, probedAt: 0 };
  } catch {
    return { live: false, probedAt: 0 };
  }
}

type LastSent = { at: number; latitude: number; longitude: number };

function metersBetween(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLng = radians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

async function readLastSent(): Promise<LastSent | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SENT_KEY);
    return raw ? (JSON.parse(raw) as LastSent) : null;
  } catch {
    return null;
  }
}

// Defined at import time: Android starts the JS runtime for the task without
// any screen, so this module is imported from the root layout.
if (Platform.OS !== "web" && !TaskManager.isTaskDefined(CHILD_LOCATION_TASK)) {
  TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(CHILD_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      console.warn("[background location]", error.message);
      return;
    }

    const latest = data?.locations?.at(-1);
    if (!latest) return;
    void listenForLiveWake();

    const point = { latitude: latest.coords.latitude, longitude: latest.coords.longitude };
    const last = await readLastSent();
    if (!(await shareLive(latest, last))) return;
    const due =
      !last ||
      latest.timestamp - last.at >= STILL_SAVE_MS ||
      metersBetween(last, point) >= Math.max(MOVE_SAVE_M, Math.min(latest.coords.accuracy ?? 0, 100));

    // Skips duplicates and bursts of nearby fixes.
    if (!due) return;

    // The phone's own GPS speed, else the speed since the last saved point.
    const reported = latest.coords.speed != null && latest.coords.speed >= 0 ? latest.coords.speed : null;
    const speed = reported ?? (last ? speedBetween({ ...last, time: last.at }, { ...point, time: latest.timestamp }) : null);

    try {
      await recordChildPhoneLocation(point.latitude, point.longitude, latest.coords.accuracy ?? null, {
        speedMps: speed,
        headingDegrees: latest.coords.heading,
        ...classifySpeed(speed, latest.coords.accuracy),
      });
      await AsyncStorage.setItem(LAST_SENT_KEY, JSON.stringify({ at: latest.timestamp, ...point }));
    } catch (reason) {
      if (reason instanceof ChildPhoneUnlinkedError) {
        // The guardian unlinked this phone: stop sharing.
        await stopBackgroundSharing();
        return;
      }
      // Offline or server error: the next fix tries again.
      console.warn("[background location] send failed", reason);
    }
  });
}

/**
 * Live map: every fix while a guardian is watching, otherwise a check every
 * LIVE_PROBE_MS. Switches the task between 1-second and normal fixes.
 * False when the guardian unlinked this phone (sharing is stopped).
 */
async function shareLive(fix: Location.LocationObject, last: LastSent | null): Promise<boolean> {
  const state = await readLive();
  if (!state.live && fix.timestamp - state.probedAt < LIVE_PROBE_MS) return true;
  const accuracy = fix.coords.accuracy ?? null;
  const point = { latitude: fix.coords.latitude, longitude: fix.coords.longitude };
  const reported = fix.coords.speed != null && fix.coords.speed >= 0 ? fix.coords.speed : null;
  const speed = reported ?? (last ? speedBetween({ ...last, time: last.at }, { ...point, time: fix.timestamp }) : null);

  const heading = state.live ? facing(fix, speed) : null;

  if (state.live && state.latitude != null && state.longitude != null) {
    // A Wi-Fi/cell fix right after a GPS one would pull the marker away.
    const sharpRecently = (state.accuracy ?? Infinity) <= LIVE_SHARP_M && fix.timestamp - state.probedAt < LIVE_SHARP_MS;
    if (accuracy != null && accuracy > LIVE_COARSE_M && sharpRecently) return true;

    // Live and still: the marker does not move, so one fix every LIVE_STILL_MS,
    // unless the child turned (the direction arrow).
    const still = (speed ?? 0) < SPEED_BANDS.still;
    const moved = metersBetween({ latitude: state.latitude, longitude: state.longitude }, point) >= LIVE_MOVE_M;
    const turned = heading != null && (state.heading == null || angleBetween(heading, state.heading) >= LIVE_TURN_DEG);
    if (still && !moved && !turned && fix.timestamp - state.probedAt < LIVE_STILL_MS) return true;
  }

  let live: boolean | null;
  try {
    live = await pushChildPhoneLive(point.latitude, point.longitude, accuracy, fix.timestamp, {
      speedMps: speed,
      headingDegrees: heading ?? fix.coords.heading,
      ...classifySpeed(speed, accuracy),
    });
  } catch (reason) {
    if (reason instanceof ChildPhoneUnlinkedError) {
      await stopBackgroundSharing();
      return false;
    }
    // Offline: try again at the next check.
    live = false;
  }

  const next = Boolean(live);
  const saved: LiveState = { live: next, probedAt: fix.timestamp, ...point, heading, accuracy };
  await AsyncStorage.setItem(LIVE_KEY, JSON.stringify(saved)).catch(() => undefined);
  if (next !== state.live) {
    await startTask(next ? LIVE_INTERVAL_MS : CHECK_INTERVAL_MS).catch((reason) =>
      console.warn("[background location] pace change failed", reason),
    );
  }
  // The compass runs only while a guardian watches (battery).
  if (next !== Boolean(compass)) await setCompass(next);
  return true;
}

/*
 * Wake: the guardian's app sends "wake" on the public topic live-wake:<child>
 * when a map opens (no location in it). The phone then checks in at once with
 * its newest fix instead of at the next LIVE_PROBE_MS check; the database
 * still decides whether anyone is watching, so a fake wake does nothing more.
 */
let wakeChannel: RealtimeChannel | null = null;
let wakeChild: string | null = null;

async function wakeNow() {
  const fix =
    (await Location.getLastKnownPositionAsync({ maxAge: 15_000 }).catch(() => null)) ??
    (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).catch(() => null));
  if (!fix) return;
  // Forget the last check so this fix is sent now.
  const state = await readLive();
  await AsyncStorage.setItem(LIVE_KEY, JSON.stringify({ ...state, live: false, probedAt: 0 })).catch(() => undefined);
  await shareLive(fix, await readLastSent());
}

/** Listens for live-map wakes while sharing is on. Never throws. */
export async function listenForLiveWake(): Promise<void> {
  try {
    const childId = (await isBackgroundSharingOn()) ? await linkedChildId() : null;
    if (childId === wakeChild) return;
    if (wakeChannel) void supabase.removeChannel(wakeChannel);
    wakeChannel = null;
    wakeChild = childId;
    if (!childId) return;
    wakeChannel = supabase
      .channel(`live-wake:${childId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "wake" }, () => void wakeNow().catch(() => undefined))
      .subscribe();
  } catch (reason) {
    console.warn("[background location] wake listener failed", reason);
  }
}

export function backgroundSharingSupported() {
  return Platform.OS === "android" || Platform.OS === "ios";
}

export async function isBackgroundSharingOn(): Promise<boolean> {
  if (!backgroundSharingSupported()) return false;
  try {
    return await Location.hasStartedLocationUpdatesAsync(CHILD_LOCATION_TASK);
  } catch {
    return false;
  }
}

export type StartResult = "started" | "foreground-denied" | "background-denied" | "unavailable";

/**
 * Asks for "while using" then "all the time" location access (Android
 * requires that order), then starts sharing.
 */
export async function startBackgroundSharing(): Promise<StartResult> {
  if (!backgroundSharingSupported() || !(await TaskManager.isAvailableAsync())) return "unavailable";

  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== "granted") return "foreground-denied";

  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== "granted") return "background-denied";

  await startTask();
  void listenForLiveWake();
  return "started";
}

/** Starts (or restarts with the current settings) the background task. */
async function startTask(intervalMs = CHECK_INTERVAL_MS) {
  await Location.startLocationUpdatesAsync(CHILD_LOCATION_TASK, {
    // GPS: network-based fixes can be 100+ m off the road.
    accuracy: intervalMs < CHECK_INTERVAL_MS ? Location.Accuracy.BestForNavigation : Location.Accuracy.High,
    timeInterval: intervalMs,
    distanceInterval: 0,
    deferredUpdatesInterval: intervalMs,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    activityType: Location.LocationActivityType.Other,
    foregroundService: {
      notificationTitle: "SafeTrack is sharing your location",
      notificationBody: "Your guardian can see where you are. Open SafeTrack to turn this off.",
      notificationColor: "#137A50",
      killServiceOnDestroy: false,
    },
  });
}

/**
 * Sharing that was started by an older version keeps its old settings (every
 * 5 minutes, network accuracy); restart it with the current ones. Call when
 * the child dashboard opens. Never throws.
 */
export async function refreshBackgroundSharing(): Promise<void> {
  try {
    // Normal pace; the next check switches to live again if a guardian watches.
    await AsyncStorage.removeItem(LIVE_KEY).catch(() => undefined);
    if (await isBackgroundSharingOn()) await startTask();
  } catch (reason) {
    console.warn("[background location] refresh failed", reason);
  }
  void listenForLiveWake();
}

export async function stopBackgroundSharing(): Promise<void> {
  await setCompass(false);
  try {
    if (await Location.hasStartedLocationUpdatesAsync(CHILD_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(CHILD_LOCATION_TASK);
    }
  } catch (reason) {
    console.warn("[background location] stop failed", reason);
  }
  await AsyncStorage.multiRemove([LAST_SENT_KEY, LIVE_KEY]).catch(() => undefined);
  void listenForLiveWake();
}
