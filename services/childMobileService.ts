import * as Location from "expo-location";
import { Platform } from "react-native";

import { supabase } from "../lib/supabase";

/* =========================================================
   CHILD MOBILE TYPES
========================================================= */

export type ChildMobileTrackingSource =
  | "smartwatch"
  | "mobile"
  | "both"
  | string;

export type ChildSafeZoneState =
  | "inside"
  | "outside"
  | "no_safe_zone"
  | "unavailable";

export interface ChildMobileLocation {
  id: string;
  childId: string;
  childName?: string | null;
  guardianId?: string | null;
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  source: string;
  locationLabel?: string | null;
  recordedAt: string;
}

export interface ChildMobileContext {
  childId: string;
  childName: string;
  guardianId: string;
  guardianName: string;
  guardianEmail: string;
  trackingSource: ChildMobileTrackingSource;
  mobileDeviceActive: boolean;
  mobilePlatform?: string | null;
  linkedAt?: string | null;
  latestLocation: ChildMobileLocation | null;
}

export interface ChildSafeZoneStatus {
  status: ChildSafeZoneState;
  zoneName?: string | null;
  message: string;
  latestLocationAt?: string | null;
}

export interface ChildMobileLinkCode {
  childId: string;
  linkCode: string;
  expiresAt: string;
}

export interface ChildMobileSosAlert {
  id: string;
  status: "active" | "acknowledged" | string;
  activationMethod?: string | null;
  triggeredAt: string;
  acknowledgedAt: string | null;
  realertCount: number;
  latitude?: number | null;
  longitude?: number | null;
}

type UnknownRecord = Record<string, unknown>;

/* =========================================================
   HELPER FUNCTIONS
========================================================= */

function getErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const value = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
    };

    const message =
      typeof value.message === "string"
        ? value.message
        : "";

    const details =
      typeof value.details === "string"
        ? value.details
        : "";

    const hint =
      typeof value.hint === "string"
        ? value.hint
        : "";

    const combined = [message, details, hint]
      .filter(Boolean)
      .join(" ");

    if (combined) {
      return combined;
    }
  }

  return fallback;
}

function asRecord(
  value: unknown
): UnknownRecord | null {
  if (
    value !== null &&
    typeof value === "object"
  ) {
    return value as UnknownRecord;
  }

  return null;
}

function asText(
  value: unknown,
  fallback = ""
): string {
  if (
    typeof value === "string" &&
    value.trim()
  ) {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  return fallback;
}

function asNullableText(
  value: unknown
): string | null {
  const text = asText(value);
  return text || null;
}

function asNumber(
  value: unknown,
  fallback = 0
): number {
  const numericValue = Number(value);

  return Number.isFinite(numericValue)
    ? numericValue
    : fallback;
}

function asNullableNumber(
  value: unknown
): number | null {
  const numericValue = Number(value);

  return Number.isFinite(numericValue)
    ? numericValue
    : null;
}

function asBoolean(value: unknown): boolean {
  return (
    value === true ||
    value === "true" ||
    value === 1
  );
}

function readField(
  row: UnknownRecord,
  camelCaseField: string,
  snakeCaseField: string
): unknown {
  return (
    row[camelCaseField] ??
    row[snakeCaseField]
  );
}

/* =========================================================
   DATA MAPPERS
========================================================= */

function mapLocation(
  value: unknown
): ChildMobileLocation | null {
  const row = asRecord(value);

  if (!row) {
    return null;
  }

  return {
    id: asText(row.id),

    childId: asText(
      readField(
        row,
        "childId",
        "child_id"
      )
    ),

    childName: asNullableText(
      readField(
        row,
        "childName",
        "child_name"
      )
    ),

    guardianId: asNullableText(
      readField(
        row,
        "guardianId",
        "guardian_id"
      )
    ),

    latitude: asNumber(
      row.latitude
    ),

    longitude: asNumber(
      row.longitude
    ),

    accuracyMeters:
      asNullableNumber(
        readField(
          row,
          "accuracyMeters",
          "accuracy_meters"
        )
      ),

    source: asText(
      row.source,
      "mobile"
    ),

    locationLabel:
      asNullableText(
        readField(
          row,
          "locationLabel",
          "location_label"
        )
      ),

    recordedAt: asText(
      readField(
        row,
        "recordedAt",
        "recorded_at"
      )
    ),
  };
}

function mapChildContext(
  value: unknown
): ChildMobileContext {
  const row = asRecord(value);

  if (!row) {
    throw new Error(
      "SafeTrack could not load the child-device connection."
    );
  }

  return {
    childId: asText(
      readField(
        row,
        "childId",
        "child_id"
      )
    ),

    childName: asText(
      readField(
        row,
        "childName",
        "child_name"
      ),
      "Child"
    ),

    guardianId: asText(
      readField(
        row,
        "guardianId",
        "guardian_id"
      )
    ),

    guardianName: asText(
      readField(
        row,
        "guardianName",
        "guardian_name"
      ),
      "Guardian"
    ),

    guardianEmail: asText(
      readField(
        row,
        "guardianEmail",
        "guardian_email"
      ),
      "No email record"
    ),

    trackingSource: asText(
      readField(
        row,
        "trackingSource",
        "tracking_source"
      ),
      "mobile"
    ),

    mobileDeviceActive: asBoolean(
      readField(
        row,
        "mobileDeviceActive",
        "mobile_device_active"
      )
    ),

    mobilePlatform:
      asNullableText(
        readField(
          row,
          "mobilePlatform",
          "mobile_platform"
        )
      ),

    linkedAt: asNullableText(
      readField(
        row,
        "linkedAt",
        "linked_at"
      )
    ),

    latestLocation: mapLocation(
      readField(
        row,
        "latestLocation",
        "latest_location"
      )
    ),
  };
}

function mapSafeZoneStatus(
  value: unknown
): ChildSafeZoneStatus {
  const row = asRecord(value);

  if (!row) {
    throw new Error(
      "SafeTrack could not load safe-zone status."
    );
  }

  const rawStatus = asText(
    row.status,
    "unavailable"
  );

  const status: ChildSafeZoneState =
    rawStatus === "inside" ||
    rawStatus === "outside" ||
    rawStatus === "no_safe_zone"
      ? rawStatus
      : "unavailable";

  return {
    status,

    zoneName: asNullableText(
      readField(
        row,
        "zoneName",
        "zone_name"
      )
    ),

    message: asText(
      row.message,
      "Location update unavailable."
    ),

    latestLocationAt:
      asNullableText(
        readField(
          row,
          "latestLocationAt",
          "latest_location_at"
        )
      ),
  };
}

function mapSosAlert(
  value: unknown
): ChildMobileSosAlert | null {
  const row = asRecord(value);

  if (!row) {
    return null;
  }

  return {
    id: asText(row.id),

    status: asText(
      row.status,
      "active"
    ),

    activationMethod:
      asNullableText(
        readField(
          row,
          "activationMethod",
          "activation_method"
        )
      ),

    triggeredAt: asText(
      readField(
        row,
        "triggeredAt",
        "triggered_at"
      )
    ),

    acknowledgedAt:
      asNullableText(
        readField(
          row,
          "acknowledgedAt",
          "acknowledged_at"
        )
      ),

    realertCount: asNumber(
      readField(
        row,
        "realertCount",
        "realert_count"
      )
    ),

    latitude: asNullableNumber(
      row.latitude
    ),

    longitude: asNullableNumber(
      row.longitude
    ),
  };
}

function createInstallationId(): string {
  return [
    Platform.OS,
    Date.now().toString(36),
    Math.random()
      .toString(36)
      .slice(2, 12),
  ].join("-");
}

/* =========================================================
   CHILD SESSION
========================================================= */

async function ensureChildDeviceSession(): Promise<void> {
  const {
    data,
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message);
  }

  const user = data.session?.user as
    | {
        is_anonymous?: boolean;
        app_metadata?: {
          provider?: string;
        };
      }
    | undefined;

  if (user) {
    const isAnonymous =
      user.is_anonymous === true ||
      user.app_metadata?.provider ===
        "anonymous";

    if (isAnonymous) {
      return;
    }

    throw new Error(
      "This phone is currently signed in as a Guardian or Administrator. Sign out that account before linking this phone as a child device."
    );
  }

  const {
    data: anonymousData,
    error: anonymousError,
  } =
    await supabase.auth.signInAnonymously();

  if (
    anonymousError ||
    !anonymousData.session
  ) {
    throw new Error(
      getErrorMessage(
        anonymousError,
        "SafeTrack could not create the child-device session."
      )
    );
  }
}

/* =========================================================
   GUARDIAN FUNCTIONS
========================================================= */

export async function createGuardianChildMobileLinkCode(
  childId: string
): Promise<ChildMobileLinkCode> {
  const {
    data,
    error,
  } = await supabase.rpc(
    "create_child_mobile_link_code",
    {
      p_child_id: childId,
    }
  );

  if (error) {
    throw new Error(
      getErrorMessage(
        error,
        "SafeTrack could not create the temporary child-device connection code."
      )
    );
  }

  const row = Array.isArray(data)
    ? data[0]
    : data;

  const result = asRecord(row);

  if (!result) {
    throw new Error(
      "SafeTrack did not return a child-device connection code."
    );
  }

  return {
    childId: asText(
      result.child_id ??
        result.childId
    ),

    linkCode: asText(
      result.link_code ??
        result.linkCode
    ),

    expiresAt: asText(
      result.expires_at ??
        result.expiresAt
    ),
  };
}

/* =========================================================
   CHILD DEVICE LINKING
========================================================= */

export async function linkChildMobileDevice(
  linkCode: string
): Promise<ChildMobileContext> {
  await ensureChildDeviceSession();

  const {
    data,
    error,
  } = await supabase.rpc(
    "link_child_mobile_device",
    {
      p_link_code: linkCode
        .trim()
        .toUpperCase(),

      p_installation_id:
        createInstallationId(),

      p_platform:
        Platform.OS,
    }
  );

  if (error) {
    throw new Error(
      getErrorMessage(
        error,
        "SafeTrack could not link this child phone."
      )
    );
  }

  return mapChildContext(data);
}

export async function fetchChildMobileContext(): Promise<
  ChildMobileContext | null
> {
  await ensureChildDeviceSession();

  const {
    data,
    error,
  } = await supabase.rpc(
    "get_child_mobile_context"
  );

  if (error) {
    throw new Error(
      getErrorMessage(
        error,
        "SafeTrack could not load the Child Dashboard."
      )
    );
  }

  if (!data) {
    return null;
  }

  return mapChildContext(data);
}

/* =========================================================
   LOCATION FUNCTIONS
========================================================= */

export async function sendChildMobileLocation(): Promise<ChildMobileLocation> {
  await ensureChildDeviceSession();

  const permission =
    await Location.requestForegroundPermissionsAsync();

  if (permission.status !== "granted") {
    throw new Error(
      "Location permission is required to send the latest available location to the linked Guardian."
    );
  }

  const currentLocation =
    await Location.getCurrentPositionAsync(
      {
        accuracy:
          Location.Accuracy.Balanced,
      }
    );

  const {
    data,
    error,
  } = await supabase.rpc(
    "record_child_mobile_location",
    {
      p_latitude:
        currentLocation.coords.latitude,

      p_longitude:
        currentLocation.coords.longitude,

      p_accuracy_meters:
        currentLocation.coords
          .accuracy ?? null,

      p_location_label: null,
    }
  );

  if (error) {
    throw new Error(
      getErrorMessage(
        error,
        "SafeTrack could not save the child location update."
      )
    );
  }

  const savedLocation =
    mapLocation(data);

  if (!savedLocation) {
    throw new Error(
      "SafeTrack could not read the saved child location update."
    );
  }

  return savedLocation;
}

/* Compatibility export */
export const publishChildMobileLocation =
  sendChildMobileLocation;

export async function fetchChildSafeZoneStatus(): Promise<ChildSafeZoneStatus> {
  await ensureChildDeviceSession();

  const {
    data,
    error,
  } = await supabase.rpc(
    "get_child_mobile_safe_zone_status"
  );

  if (error) {
    throw new Error(
      getErrorMessage(
        error,
        "SafeTrack could not load safe-zone status."
      )
    );
  }

  return mapSafeZoneStatus(data);
}

/* =========================================================
   SOS FUNCTIONS
========================================================= */

export async function createChildMobileSosAlert(): Promise<ChildMobileSosAlert> {
  await ensureChildDeviceSession();

  const {
    data,
    error,
  } = await supabase.rpc(
    "create_child_mobile_sos_alert"
  );

  if (error) {
    throw new Error(
      getErrorMessage(
        error,
        "SafeTrack could not send the SOS alert."
      )
    );
  }

  const alert =
    mapSosAlert(data);

  if (!alert) {
    throw new Error(
      "SafeTrack did not return the SOS alert record."
    );
  }

  return alert;
}

export async function fetchChildMobileActiveSos(): Promise<
  ChildMobileSosAlert | null
> {
  await ensureChildDeviceSession();

  const {
    data,
    error,
  } = await supabase.rpc(
    "get_child_mobile_active_sos"
  );

  if (error) {
    throw new Error(
      getErrorMessage(
        error,
        "SafeTrack could not check active SOS status."
      )
    );
  }

  return mapSosAlert(data);
}

export async function recordChildMobileSosRealert(
  alertId: string
): Promise<ChildMobileSosAlert | null> {
  await ensureChildDeviceSession();

  const {
    data,
    error,
  } = await supabase.rpc(
    "realert_child_mobile_sos",
    {
      p_alert_id: alertId,
    }
  );

  if (error) {
    throw new Error(
      getErrorMessage(
        error,
        "SafeTrack could not update SOS re-alert information."
      )
    );
  }

  return mapSosAlert(data);
}

/* =========================================================
   DISCONNECT CHILD PHONE
========================================================= */

export async function disconnectChildMobileDevice(): Promise<void> {
  await ensureChildDeviceSession();

  const {
    error,
  } = await supabase.rpc(
    "unlink_current_child_mobile_device"
  );

  if (error) {
    throw new Error(
      getErrorMessage(
        error,
        "SafeTrack could not disconnect this child phone."
      )
    );
  }

  const {
    error: signOutError,
  } =
    await supabase.auth.signOut();

  if (signOutError) {
    throw new Error(
      signOutError.message
    );
  }
}