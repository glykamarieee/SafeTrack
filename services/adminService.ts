import { supabase } from "../lib/supabase";
import type { AdminSummaryMetrics } from "../types/safetrack";

export type AccountStatus = "active" | "inactive";

export type AdminGuardianAccount = {
  guardianId: string;
  fullName: string;
  email: string;
  accountStatus: AccountStatus;
  createdAt: string | null;
  registeredChildren: number;
  activeDevices: number;
  activeSafeZones: number;
  activeSosAlerts: number;
};

export type AdminGuardianChildDetail = {
  childId: string;
  fullName: string;
  age: number | null;
  relationship: string | null;
  trackingSource: string | null;
  deviceCount: number;
  activeDeviceCount: number;
  safeZoneCount: number;
  latestLocationAt: string | null;
};

export type AdminGuardianDetail = {
  guardianId: string;
  fullName: string;
  email: string;
  accountStatus: AccountStatus;
  createdAt: string | null;
  registeredChildren: number;
  activeDevices: number;
  activeSafeZones: number;
  activeSosAlerts: number;
  children: AdminGuardianChildDetail[];
};

export type AdminSmartwatchDevice = {
  deviceId: string;
  watchId: string;
  childId: string | null;
  childName: string;
  guardianId: string | null;
  guardianName: string;
  guardianAccountStatus: AccountStatus;
  isActive: boolean;
  pairedAt: string | null;
  latestLocationAt: string | null;
};

export type AdminSmartwatchDeviceDetail = {
  deviceId: string;
  watchId: string;
  isActive: boolean;
  pairedAt: string | null;
  childId: string | null;
  childName: string;
  age: number | null;
  trackingSource: string | null;
  guardianId: string | null;
  guardianName: string;
  guardianEmail: string;
  guardianAccountStatus: AccountStatus;
  latestLocationAt: string | null;
  safeZoneCount: number;
  activeSosAlerts: number;
};

export type AdminReportSummary = {
  guardianAccounts: number;
  registeredChildren: number;
  smartwatchDevices: number;
  locationRecords: number;
  safeZoneEvents: number;
  sosRecords: number;
};

type UnknownRecord = Record<string, unknown>;

function toCount(value: unknown) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : 0;
}

function toText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : fallback;
}

function toNullableText(value: unknown) {
  const text = toText(value);

  return text || null;
}

function toNullableNumber(value: unknown) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : null;
}

function toBoolean(value: unknown) {
  return value === true || value === "true" || value === 1;
}

function normalizeStatus(value: unknown): AccountStatus {
  return String(value ?? "").toLowerCase() === "inactive"
    ? "inactive"
    : "active";
}

function toArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export async function fetchAdminSummaryMetrics(): Promise<AdminSummaryMetrics> {
  const { data, error } = await supabase
    .rpc("get_admin_summary_metrics")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("SafeTrack could not load administrator metrics.");
  }

  const row = data as UnknownRecord;

  return {
    guardianAccounts: toCount(row.guardian_accounts),
    administratorAccounts: toCount(row.administrator_accounts),
    registeredChildren: toCount(row.registered_children),
    activeDevices: toCount(row.active_devices),
    activeSafeZones: toCount(row.active_safe_zones),
    locationRecords: toCount(row.location_records),
    activeSosAlerts: toCount(row.active_sos_alerts),
    generatedReports: toCount(row.generated_reports),
  };
}

export async function fetchAdminGuardianAccounts(
  search = ""
): Promise<AdminGuardianAccount[]> {
  const { data, error } = await supabase.rpc(
    "get_admin_guardian_accounts",
    {
      p_search: search.trim() || null,
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  return toArray(data).map((item) => {
    const row = item as UnknownRecord;

    return {
      guardianId: toText(row.guardian_id),
      fullName: toText(row.full_name, "Guardian"),
      email: toText(row.email, "No email record"),
      accountStatus: normalizeStatus(row.account_status),
      createdAt: toNullableText(row.created_at),
      registeredChildren: toCount(row.registered_children),
      activeDevices: toCount(row.active_devices),
      activeSafeZones: toCount(row.active_safe_zones),
      activeSosAlerts: toCount(row.active_sos_alerts),
    };
  });
}

export async function fetchAdminGuardianDetail(
  guardianId: string
): Promise<AdminGuardianDetail> {
  const { data, error } = await supabase.rpc(
    "get_admin_guardian_detail",
    {
      p_guardian_id: guardianId,
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  if (!data || typeof data !== "object") {
    throw new Error("SafeTrack could not load Guardian account details.");
  }

  const row = data as UnknownRecord;

  const children = toArray(row.children).map((item) => {
    const child = item as UnknownRecord;

    return {
      childId: toText(child.childId),
      fullName: toText(child.fullName, "Child"),
      age: toNullableNumber(child.age),
      relationship: toNullableText(child.relationship),
      trackingSource: toNullableText(child.trackingSource),
      deviceCount: toCount(child.deviceCount),
      activeDeviceCount: toCount(child.activeDeviceCount),
      safeZoneCount: toCount(child.safeZoneCount),
      latestLocationAt: toNullableText(child.latestLocationAt),
    };
  });

  return {
    guardianId: toText(row.guardianId),
    fullName: toText(row.fullName, "Guardian"),
    email: toText(row.email, "No email record"),
    accountStatus: normalizeStatus(row.accountStatus),
    createdAt: toNullableText(row.createdAt),
    registeredChildren: toCount(row.registeredChildren),
    activeDevices: toCount(row.activeDevices),
    activeSafeZones: toCount(row.activeSafeZones),
    activeSosAlerts: toCount(row.activeSosAlerts),
    children,
  };
}

export async function updateAdminGuardianAccountStatus(
  guardianId: string,
  status: AccountStatus
): Promise<void> {
  const { error } = await supabase.rpc(
    "update_admin_guardian_account_status",
    {
      p_guardian_id: guardianId,
      p_status: status,
    }
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchAdminSmartwatchDevices(
  search = ""
): Promise<AdminSmartwatchDevice[]> {
  const { data, error } = await supabase.rpc(
    "get_admin_smartwatch_devices",
    {
      p_search: search.trim() || null,
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  return toArray(data).map((item) => {
    const row = item as UnknownRecord;

    return {
      deviceId: toText(row.device_id),
      watchId: toText(row.watch_id, "Unassigned"),
      childId: toNullableText(row.child_id),
      childName: toText(row.child_name, "Unlinked child"),
      guardianId: toNullableText(row.guardian_id),
      guardianName: toText(row.guardian_name, "Unlinked guardian"),
      guardianAccountStatus: normalizeStatus(
        row.guardian_account_status
      ),
      isActive: toBoolean(row.is_active),
      pairedAt: toNullableText(row.paired_at),
      latestLocationAt: toNullableText(row.latest_location_at),
    };
  });
}

export async function fetchAdminSmartwatchDeviceDetail(
  deviceId: string
): Promise<AdminSmartwatchDeviceDetail> {
  const { data, error } = await supabase.rpc(
    "get_admin_smartwatch_device_detail",
    {
      p_device_id: deviceId,
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  if (!data || typeof data !== "object") {
    throw new Error("SafeTrack could not load smartwatch device details.");
  }

  const row = data as UnknownRecord;

  return {
    deviceId: toText(row.deviceId),
    watchId: toText(row.watchId, "Unassigned"),
    isActive: toBoolean(row.isActive),
    pairedAt: toNullableText(row.pairedAt),
    childId: toNullableText(row.childId),
    childName: toText(row.childName, "Unlinked child"),
    age: toNullableNumber(row.age),
    trackingSource: toNullableText(row.trackingSource),
    guardianId: toNullableText(row.guardianId),
    guardianName: toText(row.guardianName, "Unlinked guardian"),
    guardianEmail: toText(row.guardianEmail, "No email record"),
    guardianAccountStatus: normalizeStatus(
      row.guardianAccountStatus
    ),
    latestLocationAt: toNullableText(row.latestLocationAt),
    safeZoneCount: toCount(row.safeZoneCount),
    activeSosAlerts: toCount(row.activeSosAlerts),
  };
}

export async function updateAdminSmartwatchDeviceStatus(
  deviceId: string,
  status: AccountStatus
): Promise<void> {
  const { error } = await supabase.rpc(
    "update_admin_smartwatch_device_status",
    {
      p_device_id: deviceId,
      p_status: status,
    }
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchAdminReportSummary(
  startDate: string,
  endDate: string
): Promise<AdminReportSummary> {
  const { data, error } = await supabase
    .rpc("get_admin_report_summary", {
      p_start: startDate,
      p_end: endDate,
    })
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("SafeTrack could not prepare the report summary.");
  }

  const row = data as UnknownRecord;

  return {
    guardianAccounts: toCount(row.guardian_accounts),
    registeredChildren: toCount(row.registered_children),
    smartwatchDevices: toCount(row.smartwatch_devices),
    locationRecords: toCount(row.location_records),
    safeZoneEvents: toCount(row.safe_zone_events),
    sosRecords: toCount(row.sos_records),
  };
}