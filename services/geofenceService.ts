import { supabase } from "../lib/supabase";
import type { Geofence, GeofenceEvent } from "../types/safetrack";

export type GeofenceInput = {
  guardianId: string;
  childId: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isEnabled: boolean;
};

function mapZone(row: any): Geofence {
  return {
    id: row.id,
    guardianId: row.guardian_id,
    childId: row.child_id,
    name: row.name,
    address: row.address ?? undefined,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    centerLatitude: Number(row.latitude),
    centerLongitude: Number(row.longitude),
    radiusMeters: Number(row.radius_meters),
    isEnabled: Boolean(row.is_enabled),
    isActive: Boolean(row.is_enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEvent(row: any): GeofenceEvent {
  return {
    id: row.id,
    childId: row.child_id ?? undefined,
    geofenceId: row.geofence_id ?? undefined,
    locationLogId: row.location_log_id ?? undefined,
    eventType: row.event_type,
    title: row.title,
    details: row.details ?? undefined,
    anomalyScore:
      row.anomaly_score === null || row.anomaly_score === undefined
        ? undefined
        : Number(row.anomaly_score),
    latitude:
      row.latitude === null || row.latitude === undefined
        ? undefined
        : Number(row.latitude),
    longitude:
      row.longitude === null || row.longitude === undefined
        ? undefined
        : Number(row.longitude),
    occurredAt: row.occurred_at,
  };
}

export async function fetchGeofences(
  guardianId: string,
  childId: string
): Promise<Geofence[]> {
  const { data, error } = await supabase
    .from("geofences")
    .select("*")
    .eq("guardian_id", guardianId)
    .eq("child_id", childId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapZone);
}

export async function fetchGeofenceEvents(
  childId: string,
  limit = 30
): Promise<GeofenceEvent[]> {
  const { data, error } = await supabase
    .from("geofence_events")
    .select("*")
    .eq("child_id", childId)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(mapEvent);
}

export async function createGeofence(input: GeofenceInput): Promise<Geofence> {
  const { data, error } = await supabase
    .from("geofences")
    .insert({
      guardian_id: input.guardianId,
      child_id: input.childId,
      name: input.name.trim(),
      address: input.address?.trim() || null,
      latitude: input.latitude,
      longitude: input.longitude,
      radius_meters: Math.round(input.radiusMeters),
      is_enabled: input.isEnabled,
    })
    .select()
    .single();

  if (error) throw error;
  return mapZone(data);
}

export async function updateGeofence(
  id: string,
  input: Omit<GeofenceInput, "guardianId" | "childId">
): Promise<Geofence> {
  const { data, error } = await supabase
    .from("geofences")
    .update({
      name: input.name.trim(),
      address: input.address?.trim() || null,
      latitude: input.latitude,
      longitude: input.longitude,
      radius_meters: Math.round(input.radiusMeters),
      is_enabled: input.isEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return mapZone(data);
}

export async function deleteGeofence(id: string): Promise<void> {
  const { error } = await supabase.from("geofences").delete().eq("id", id);
  if (error) throw error;
}
