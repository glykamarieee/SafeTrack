import { supabase } from "../lib/supabase";
import { verifyCurrentPassword } from "./supabaseAuthService";

export type NotificationPreferences = {
  /** Safe Zone entry and exit. */
  safeZone: boolean;
  /** AI unusual-movement notices. */
  anomaly: boolean;
  /** Watch disconnected and prolonged inactivity. */
  device: boolean;
};

/** Everything on: the same as having no saved row. SOS is always on. */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  safeZone: true,
  anomaly: true,
  device: true,
};

// supabase-js errors are plain objects, not Error instances.
function fail(error: { message?: string; code?: string }, fallback: string): never {
  // 42P01: the table does not exist yet (migration 20261015 not applied).
  if (error.code === "42P01" || error.code === "PGRST205") {
    throw new Error("Notification settings need the latest database update (migration 20261015).");
  }
  throw new Error(error.message || fallback);
}

export async function fetchNotificationPreferences(guardianId: string): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from("guardian_notification_preferences")
    .select("safe_zone, anomaly, device")
    .eq("guardian_id", guardianId)
    .maybeSingle();

  if (error) fail(error, "Could not load notification settings.");
  if (!data) return DEFAULT_NOTIFICATION_PREFERENCES;

  return { safeZone: data.safe_zone, anomaly: data.anomaly, device: data.device };
}

export async function saveNotificationPreferences(guardianId: string, preferences: NotificationPreferences) {
  const { error } = await supabase.from("guardian_notification_preferences").upsert(
    {
      guardian_id: guardianId,
      safe_zone: preferences.safeZone,
      anomaly: preferences.anomaly,
      device: preferences.device,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "guardian_id" },
  );

  if (error) fail(error, "Could not save notification settings.");
}

export type DeleteAccountResult = {
  childrenDeleted: number;
  childrenKeptWithOtherGuardian: number;
};

/**
 * Deletes the signed-in guardian's account after confirming their password
 * (`delete_my_account`, a soft delete). The caller signs out afterwards.
 */
export async function deleteMyAccount(currentPassword: string): Promise<DeleteAccountResult> {
  await verifyCurrentPassword(currentPassword);

  const { data, error } = await supabase.rpc("delete_my_account");

  if (error) {
    if (error.code === "PGRST202") {
      throw new Error("Account deletion needs the latest database update (migration 20261015).");
    }
    throw new Error(error.message || "Your account could not be deleted.");
  }

  const result = (data ?? {}) as { children_deleted?: number; children_kept_with_other_guardian?: number };

  return {
    childrenDeleted: Number(result.children_deleted ?? 0),
    childrenKeptWithOtherGuardian: Number(result.children_kept_with_other_guardian ?? 0),
  };
}
