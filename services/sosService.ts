import { supabase } from "../lib/supabase";
import type { SosAlert, SosAlertStatus } from "../types/safetrack";

export function mapSosRow(row: any, childName = "Child"): SosAlert {
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
  return (data ?? []).map((row) => mapSosRow(row, childName));
}

export async function fetchAllSosAlerts(): Promise<SosAlert[]> {
  const { data, error } = await supabase
    .from("sos_alerts")
    .select("*")
    .order("triggered_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => mapSosRow(row));
}

export async function acknowledgeSosAlert(alertId: string): Promise<void> {
  const { error } = await supabase.rpc("acknowledge_my_sos_alert", {
    p_alert_id: alertId,
  });

  if (error) throw error;
}

/**
 * Live SOS changes for the signed-in guardian: new alerts, re-alerts and
 * acknowledgements. RLS limits the stream to the guardian's own alerts.
 * Returns an unsubscribe function.
 */
export function subscribeToGuardianSos(guardianId: string, onRow: (row: Record<string, unknown>) => void) {
  // A unique topic per subscription: supabase.channel() returns an existing
  // channel with the same topic, and removeChannel() is async, so a quick
  // remount would add callbacks to an already-subscribed channel and throw
  // "cannot add postgres_changes callbacks ... after subscribe()".
  const channel = supabase
    .channel(`guardian-sos-${guardianId}-${uniqueSuffix()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "sos_alerts", filter: `guardian_id=eq.${guardianId}` },
      (payload) => {
        if (payload.new && typeof payload.new === "object") onRow(payload.new as Record<string, unknown>);
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

function uniqueSuffix() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
