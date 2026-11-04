import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import * as Location from "expo-location";
import { Platform } from "react-native";

import { classifySpeed } from "../lib/travelMode";
import { supabase } from "../lib/supabase";
import type {
  ChildMobileContext,
  ChildMobileSosAlert,
  ChildSafeZoneStatus,
  LocationLog,
  TravelMode,
} from "../types/safetrack";


/*
=====================================================
CHILD PHONE CREDENTIALS

A child phone has no Supabase login. Pairing
(pair_child_phone) returns a device token that the
phone keeps and sends with every request.
=====================================================
*/

const CREDENTIALS_KEY = "safetrack.childPhone";

type ChildPhoneCredentials = {
  childId: string;
  deviceToken: string;
};

/** The phone was unlinked (or its token revoked) on the server. */
export class ChildPhoneUnlinkedError extends Error {}

async function readCredentials(): Promise<ChildPhoneCredentials | null> {
  try {
    const raw = await AsyncStorage.getItem(CREDENTIALS_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<ChildPhoneCredentials>;
    return parsed.childId && parsed.deviceToken
      ? { childId: parsed.childId, deviceToken: parsed.deviceToken }
      : null;
  } catch {
    return null;
  }
}

export async function clearChildPhoneCredentials() {
  await AsyncStorage.removeItem(CREDENTIALS_KEY);
}

export async function hasChildPhoneCredentials() {
  return (await readCredentials()) !== null;
}


/*
=====================================================
DATABASE CALLS
=====================================================
*/

// Raised by child_phone_device() when the token is no longer valid.
const UNLINKED_ERROR_CODE = "28000";

/**
 * Call a child_phone_* database function with this phone's
 * stored credentials.
 */
async function callAsChildPhone<T>(
  functionName:
    | "get_child_phone_state"
    | "record_child_phone_location"
    | "record_child_phone_location_v2"
    | "trigger_child_phone_sos"
    | "realert_child_phone_sos"
    | "unlink_child_phone",
  args: Record<string, unknown> = {}
): Promise<T> {
  const credentials = await readCredentials();

  if (!credentials) {
    throw new ChildPhoneUnlinkedError(
      "This phone is not linked. Enter a new code from the Guardian."
    );
  }

  const { data, error } = await supabase.rpc(functionName, {
    p_child_id: credentials.childId,
    p_device_token: credentials.deviceToken,
    ...args,
  });

  if (error) {
    if (error.code === UNLINKED_ERROR_CODE) {
      await clearChildPhoneCredentials();
      throw new ChildPhoneUnlinkedError(error.message);
    }

    throw new Error(error.message);
  }

  return data as T;
}


/*
=====================================================
MAPPING
=====================================================
*/

type LocationRow = {
  id: string;
  child_id: string;
  source: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  recorded_at: string;
};

function toLocationLog(row: LocationRow | null): LocationLog | null {
  if (!row) return null;

  return {
    id: row.id,
    childId: row.child_id,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    accuracyMeters: row.accuracy_meters,
    source: row.source,
    recordedAt: row.recorded_at,
  };
}

export type ChildPhoneState = {
  context: ChildMobileContext;
  latestLocation: LocationLog | null;
  safeZoneStatus: ChildSafeZoneStatus;
  activeSos: ChildMobileSosAlert | null;
};


/*
=====================================================
LINK / STATE / UNLINK
=====================================================
*/

export async function linkChildPhone(connectionCode: string) {
  const { data, error } = await supabase.rpc("pair_child_phone", {
    p_code: connectionCode.replace(/\D/g, ""),
    p_platform: Platform.OS,
    p_device_model: Device.modelName ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.childId || !data.deviceToken) {
    throw new Error("Unable to link this child phone.");
  }

  const credentials: ChildPhoneCredentials = {
    childId: data.childId,
    deviceToken: data.deviceToken,
  };

  await AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
}

export async function fetchChildPhoneState(): Promise<ChildPhoneState> {
  const data = await callAsChildPhone<{
    context: ChildMobileContext;
    latestLocation: LocationRow | null;
    safeZoneStatus: ChildSafeZoneStatus;
    activeSos: ChildMobileSosAlert | null;
  }>("get_child_phone_state");

  const latestLocation = toLocationLog(data.latestLocation);

  return {
    context: { ...data.context, latestLocation },
    latestLocation,
    safeZoneStatus: data.safeZoneStatus,
    activeSos: data.activeSos,
  };
}

export async function unlinkChildPhone() {
  try {
    await callAsChildPhone("unlink_child_phone");
  } catch (error) {
    // Already unlinked on the server: still forget it locally.
    if (!(error instanceof ChildPhoneUnlinkedError)) throw error;
  } finally {
    await clearChildPhoneCredentials();
  }
}


/*
=====================================================
LOCATION
=====================================================
*/

export async function sendCurrentChildPhoneLocation(): Promise<{
  location: LocationLog;
  safeZoneStatus: ChildSafeZoneStatus;
}> {
  const permission = await Location.requestForegroundPermissionsAsync();

  if (permission.status !== "granted") {
    throw new Error(
      "Location permission is required to share this phone's location with the Guardian."
    );
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  const speed = position.coords.speed != null && position.coords.speed >= 0 ? position.coords.speed : null;
  return recordChildPhoneLocation(
    position.coords.latitude,
    position.coords.longitude,
    position.coords.accuracy,
    { speedMps: speed, headingDegrees: position.coords.heading, ...classifySpeed(speed, position.coords.accuracy) }
  );
}

/**
 * Stores one location for the linked child (`record_child_phone_location`).
 * Used by the "Send latest location" button and the background task.
 */
export type PhoneMotion = {
  speedMps: number | null;
  headingDegrees?: number | null;
  mode: TravelMode;
  confidence: number;
};

// record_child_phone_location_v2 (migration 20261104) also stores speed and
// travel mode. Until the migration runs, fall back to the original once.
let motionFunction = true;

export async function recordChildPhoneLocation(
  latitude: number,
  longitude: number,
  accuracyMeters: number | null,
  motion?: PhoneMotion
): Promise<{
  location: LocationLog;
  safeZoneStatus: ChildSafeZoneStatus;
}> {
  const base = {
    p_latitude: latitude,
    p_longitude: longitude,
    p_accuracy_meters: accuracyMeters,
  };
  type Result = { location: LocationRow; safeZoneStatus: ChildSafeZoneStatus };
  let data: Result | null = null;

  if (motion && motionFunction) {
    try {
      data = await callAsChildPhone<Result>("record_child_phone_location_v2", {
        ...base,
        p_speed_mps: motion.speedMps,
        p_heading_degrees: motion.headingDegrees != null && motion.headingDegrees >= 0 ? motion.headingDegrees : null,
        p_travel_mode: motion.mode,
        p_mode_confidence: Math.round(motion.confidence * 100) / 100,
      });
    } catch (reason) {
      if (reason instanceof Error && /could not find the function|PGRST202/i.test(reason.message)) {
        motionFunction = false;
      } else {
        throw reason;
      }
    }
  }

  if (!data) {
    data = await callAsChildPhone<Result>("record_child_phone_location", base);
  }

  return {
    location: toLocationLog(data.location)!,
    safeZoneStatus: data.safeZoneStatus,
  };
}


/*
=====================================================
SOS
=====================================================
*/

export async function triggerChildPhoneSos(): Promise<ChildMobileSosAlert> {
  return callAsChildPhone<ChildMobileSosAlert>("trigger_child_phone_sos");
}

export async function realertChildPhoneSos(
  sosId: string
): Promise<ChildMobileSosAlert | null> {
  return callAsChildPhone<ChildMobileSosAlert | null>(
    "realert_child_phone_sos",
    { p_sos_id: sosId }
  );
}
