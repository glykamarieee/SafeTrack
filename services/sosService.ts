import { supabase } from "../lib/supabase";
import type { SosAlert, SosAlertStatus } from "../types/safetrack";

function mapRow(row: any, childName = "Child"): SosAlert {
  return {
    id: row.id,
    childId: row.child_id,
    childName,
    guardianId: row.guardian_id,
    status: row.status as SosAlertStatus,
    activationMethod: row.activation_method,
    isTestAlert: Boolean(row.is_test),
    locationLogId: row.location_log_id ?? undefined,
    locationSource: row.location_source ?? undefined,
    latitude:
      row.latitude === null || row.latitude === undefined
        ? undefined
        : Number(row.latitude),
    longitude:
      row.longitude === null || row.longitude === undefined
        ? undefined
        : Number(row.longitude),
    accuracyMeters:
      row.accuracy_meters === null || row.accuracy_meters === undefined
        ? undefined
        : Number(row.accuracy_meters),
    triggeredAt: row.triggered_at,
    acknowledgedAt: row.acknowledged_at ?? undefined,
    realertCount: row.realert_count ?? 0,
  };
}

export async function fetchSosAlertsForChild(
  childId: string,
  childName = "Child"
): Promise<SosAlert[]> {
  const { data, error } = await supabase
    .from("sos_alerts")
    .select("*")
    .eq("child_id", childId)
    .order("triggered_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => mapRow(row, childName));
}

export async function fetchAllSosAlerts(): Promise<SosAlert[]> {
  const { data, error } = await supabase
    .from("sos_alerts")
    .select("*")
    .order("triggered_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => mapRow(row));
}

export async function triggerTestSosAlert(
  childId: string,
  childName = "Child"
): Promise<SosAlert> {
  const { data, error } = await supabase.rpc("trigger_my_test_sos_alert", {
    p_child_id: childId,
  });

  if (error) throw error;
  if (!data || typeof data !== "object") {
    throw new Error("SafeTrack did not receive the test SOS alert.");
  }

  return mapRow(data, childName);
}

export async function acknowledgeSosAlert(alertId: string): Promise<void> {
  const { error } = await supabase.rpc("acknowledge_my_sos_alert", {
    p_alert_id: alertId,
  });

  if (error) throw error;
}

export async function resolveSosAlert(alertId: string): Promise<void> {
  const { error } = await supabase.rpc("resolve_my_sos_alert", {
    p_alert_id: alertId,
  });

  if (error) throw error;
}
