import { supabase } from "../lib/supabase";
import { philippineDayRange } from "./activityHistoryService";

/**
 * Administrator record lists. Read directly from the tables: RLS lets
 * administrators read them (`is_safetrack_admin()` SELECT policies on
 * sos_alerts, location_logs and geofence_events) and nobody else sees other
 * families' rows. Child names come from `persons` (admins may read them).
 */

export type AdminRecordKind = "sos" | "location" | "safety";

export type AdminRecord = {
  id: string;
  kind: AdminRecordKind;
  childId: string | null;
  childName: string;
  title: string;
  detail: string;
  occurredAt: string;
  latitude: number | null;
  longitude: number | null;
  /** SOS status, location source, or event type. */
  tag: string;
};

export type AdminRecordPage = { records: AdminRecord[]; hasMore: boolean };

export const ADMIN_PAGE_SIZE = 50;

const METHOD_LABELS: Record<string, string> = {
  tap_and_hold: "tap and hold",
  tap_hold: "tap and hold",
  manual_button: "button",
  shake: "shake",
};

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function childNames(ids: (string | null)[]) {
  const unique = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
  const names = new Map<string, string>();
  if (!unique.length) return names;

  const { data, error } = await supabase.from("persons").select("id, full_name").in("id", unique);
  if (error) throw error;
  (data ?? []).forEach((row) => names.set(String(row.id), String(row.full_name ?? "Unknown child")));

  return names;
}

/**
 * One page of records between two Philippine dates (inclusive), newest first.
 * Fetches one extra row to know whether another page exists.
 */
export async function fetchAdminRecords(
  kind: AdminRecordKind,
  fromKey: string,
  toKey: string,
  page: number,
): Promise<AdminRecordPage> {
  const start = philippineDayRange(fromKey).start;
  const end = philippineDayRange(toKey).end;
  const first = page * ADMIN_PAGE_SIZE;
  const last = first + ADMIN_PAGE_SIZE; // one extra row

  if (kind === "sos") {
    const { data, error } = await supabase
      .from("sos_alerts")
      .select("id, child_id, status, activation_method, triggered_at, acknowledged_at, realert_count, is_test, latitude, longitude")
      .gte("triggered_at", start)
      .lt("triggered_at", end)
      .order("triggered_at", { ascending: false })
      .range(first, last);
    if (error) throw error;

    const rows = data ?? [];
    const names = await childNames(rows.map((row) => row.child_id));
    return {
      hasMore: rows.length > ADMIN_PAGE_SIZE,
      records: rows.slice(0, ADMIN_PAGE_SIZE).map((row) => ({
        id: String(row.id),
        kind,
        childId: row.child_id,
        childName: names.get(String(row.child_id)) ?? "Unknown child",
        title: row.is_test ? "Test SOS" : "SOS alert",
        detail: [
          `Activated by ${METHOD_LABELS[String(row.activation_method)] ?? String(row.activation_method ?? "unknown")}`,
          row.realert_count ? `re-alerted ${row.realert_count}×` : null,
          row.acknowledged_at ? `acknowledged ${new Date(row.acknowledged_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        occurredAt: String(row.triggered_at),
        latitude: numberOrNull(row.latitude),
        longitude: numberOrNull(row.longitude),
        tag: String(row.status),
      })),
    };
  }

  if (kind === "location") {
    const { data, error } = await supabase
      .from("location_logs")
      .select("id, child_id, source, latitude, longitude, accuracy_meters, location_label, recorded_at")
      .gte("recorded_at", start)
      .lt("recorded_at", end)
      .order("recorded_at", { ascending: false })
      .range(first, last);
    if (error) throw error;

    const rows = data ?? [];
    const names = await childNames(rows.map((row) => row.child_id));
    return {
      hasMore: rows.length > ADMIN_PAGE_SIZE,
      records: rows.slice(0, ADMIN_PAGE_SIZE).map((row) => ({
        id: String(row.id),
        kind,
        childId: row.child_id,
        childName: names.get(String(row.child_id)) ?? "Unknown child",
        title: row.location_label ? String(row.location_label) : "Location record",
        detail: `${Number(row.latitude).toFixed(5)}, ${Number(row.longitude).toFixed(5)}${
          row.accuracy_meters != null ? ` · ±${Math.round(Number(row.accuracy_meters))} m` : ""
        }`,
        occurredAt: String(row.recorded_at),
        latitude: numberOrNull(row.latitude),
        longitude: numberOrNull(row.longitude),
        tag: row.source === "mobile" ? "phone" : "watch",
      })),
    };
  }

  const { data, error } = await supabase
    .from("geofence_events")
    .select("id, child_id, event_type, title, details, latitude, longitude, occurred_at")
    .gte("occurred_at", start)
    .lt("occurred_at", end)
    .order("occurred_at", { ascending: false })
    .range(first, last);
  if (error) throw error;

  const rows = data ?? [];
  const names = await childNames(rows.map((row) => row.child_id));
  return {
    hasMore: rows.length > ADMIN_PAGE_SIZE,
    records: rows.slice(0, ADMIN_PAGE_SIZE).map((row) => ({
      id: String(row.id),
      kind,
      childId: row.child_id,
      childName: names.get(String(row.child_id)) ?? "Unknown child",
      title: String(row.title ?? "Safety event"),
      detail: String(row.details ?? ""),
      occurredAt: String(row.occurred_at),
      latitude: numberOrNull(row.latitude),
      longitude: numberOrNull(row.longitude),
      tag: String(row.event_type).replaceAll("_", " "),
    })),
  };
}
