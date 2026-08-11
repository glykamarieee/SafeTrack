import { supabase } from "../lib/supabase";
import type { LocationLog } from "../types/safetrack";

function mapRow(row: any, childName = "Child"): LocationLog {
  return {
    id: row.id,
    childId: row.child_id,
    childName,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    accuracyMeters:
      row.accuracy_meters === null || row.accuracy_meters === undefined
        ? undefined
        : Number(row.accuracy_meters),
    source: row.source ?? "unknown",
    locationLabel: row.location_label ?? undefined,
    recordedAt: row.recorded_at,
  };
}

function getDayRange(dateKey: string) {
  const start = new Date(`${dateKey}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export async function fetchLatestLocationForChild(
  childId: string,
  childName = "Child"
): Promise<LocationLog | null> {
  const { data, error } = await supabase
    .from("location_logs")
    .select("*")
    .eq("child_id", childId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data ? mapRow(data, childName) : null;
}

export async function fetchLocationHistory(
  childId: string,
  limit = 80,
  childName = "Child"
): Promise<LocationLog[]> {
  const { data, error } = await supabase
    .from("location_logs")
    .select("*")
    .eq("child_id", childId)
    .order("recorded_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => mapRow(row, childName));
}

export async function fetchLocationHistoryForDate(
  childId: string,
  dateKey: string,
  childName = "Child"
): Promise<LocationLog[]> {
  const { start, end } = getDayRange(dateKey);

  const { data, error } = await supabase
    .from("location_logs")
    .select("*")
    .eq("child_id", childId)
    .gte("recorded_at", start)
    .lt("recorded_at", end)
    .order("recorded_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => mapRow(row, childName));
}

export async function fetchAllLocationRecords(
  limit = 50
): Promise<LocationLog[]> {
  const { data, error } = await supabase
    .from("location_logs")
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => mapRow(row));
}
