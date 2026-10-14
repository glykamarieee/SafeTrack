import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import { ChildPhoneUnlinkedError, recordChildPhoneLocation } from "./childMobileService";

/**
 * Optional automatic location sharing for a linked child phone.
 *
 * - Off until the child turns it on (consent), and can be turned off any time.
 * - Android shows a permanent "SafeTrack is sharing location" notification
 *   while it runs (a foreground service), iOS shows the location indicator.
 * - At most one stored location per 5 minutes unless the phone moved 100 m.
 * - Needs a development or release build; Expo Go and the web cannot run it.
 * - After the phone restarts, sharing resumes the next time SafeTrack is
 *   opened (Android does not restart the service on its own).
 */

export const CHILD_LOCATION_TASK = "safetrack-child-background-location";

const LAST_SENT_KEY = "safetrack.childPhone.lastBackgroundSend";
const MIN_INTERVAL_MS = 5 * 60 * 1000;
const MIN_DISTANCE_M = 100;

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

    const point = { latitude: latest.coords.latitude, longitude: latest.coords.longitude };
    const last = await readLastSent();
    const due =
      !last ||
      latest.timestamp - last.at >= MIN_INTERVAL_MS ||
      metersBetween(last, point) >= MIN_DISTANCE_M;

    // Skips duplicates and bursts of nearby fixes.
    if (!due) return;

    try {
      await recordChildPhoneLocation(point.latitude, point.longitude, latest.coords.accuracy ?? null);
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

  await Location.startLocationUpdatesAsync(CHILD_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: MIN_INTERVAL_MS,
    distanceInterval: MIN_DISTANCE_M,
    deferredUpdatesInterval: MIN_INTERVAL_MS,
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

  return "started";
}

export async function stopBackgroundSharing(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(CHILD_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(CHILD_LOCATION_TASK);
    }
  } catch (reason) {
    console.warn("[background location] stop failed", reason);
  }
  await AsyncStorage.removeItem(LAST_SENT_KEY).catch(() => undefined);
}
