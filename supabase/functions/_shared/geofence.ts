import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

/**
 * Record safe-zone entry/exit events for a new location and return a short
 * status line for the watch. The logic lives in the database function
 * process_safe_zone_events(), shared with child phones; inserted events
 * notify the Guardian through a database trigger.
 */
export async function processGeofences(args: {
  supabase: SupabaseClient;
  childId: string;
  locationLogId: string;
}): Promise<string> {
  const { data, error } = await args.supabase.rpc(
    "process_safe_zone_events",
    {
      p_child_id: args.childId,
      p_location_log_id: args.locationLogId,
    },
  );

  if (error) throw error;
  return data as string;
}
