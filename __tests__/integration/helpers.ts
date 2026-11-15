/**
 * Integration testing helpers. Everything here talks to the live SafeTrack backend
 * (Supabase) the same way the apps do:
 * - the Guardian / Administrator side through the app's own services (signed in
 *   through the real auth store, see ../setup/session);
 * - the smartwatch side through the same database functions the Wear OS app calls
 *   (pair_watch, record_watch_location, trigger_watch_sos, cancel_watch_sos), with
 *   the same parameter names (safe-track-wear-os .../WatchLink.kt);
 * - a child phone through the app's childMobileService.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const MODULE = "integration";

/** Lapu-Lapu City Hall, Pajo, Lapu-Lapu City (OpenStreetMap), used as the test location. */
export const LAPU = { latitude: 10.31646, longitude: 123.96523 };
/** About 1.1 km north of LAPU. */
export const LAPU_NORTH = { latitude: 10.32646, longitude: 123.96523 };

/** A connection with no account, as the watch and child phone have. */
export function deviceClient(): SupabaseClient {
  return createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type WatchSession = { watchId: string; deviceToken: string; childId: string; deviceId: string };

/** What the Wear OS app sends with every call (WatchLink.send). */
function watchParams(s: WatchSession) {
  return { p_watch_id: s.watchId, p_device_token: s.deviceToken, p_battery_percent: 80, p_network_type: "wifi", p_device_model: "Integration test watch" };
}

/** The watch's "Connect watch" step (DeviceRepositoryImpl.pair). */
export async function pairWatch(client: SupabaseClient, watchId: string, code: string): Promise<WatchSession> {
  const { data, error } = await client.rpc("pair_watch", { p_watch_id: watchId, p_connection_code: code, p_device_model: "Integration test watch" });
  if (error) throw new Error(error.message);
  return { watchId: data.watchId ?? watchId, deviceToken: data.deviceToken, childId: data.childId, deviceId: data.deviceId };
}

export async function watchLocation(client: SupabaseClient, s: WatchSession, point: { latitude: number; longitude: number }) {
  return client.rpc("record_watch_location", {
    ...watchParams(s), p_latitude: point.latitude, p_longitude: point.longitude, p_accuracy_meters: 6, p_recorded_at: new Date().toISOString(),
  });
}

export async function watchSos(client: SupabaseClient, s: WatchSession, point: { latitude: number; longitude: number }, activation = "button") {
  const now = new Date().toISOString();
  return client.rpc("trigger_watch_sos", {
    ...watchParams(s), p_activation_method: activation, p_triggered_at: now,
    p_latitude: point.latitude, p_longitude: point.longitude, p_accuracy_meters: 6, p_recorded_at: now,
  });
}

export async function watchCancelSos(client: SupabaseClient, s: WatchSession, alertId: string) {
  return client.rpc("cancel_watch_sos", { ...watchParams(s), p_sos_alert_id: alertId });
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Polls until check() returns a truthy value or the time runs out. */
export async function waitFor<T>(check: () => Promise<T | null | undefined | false>, ms: number, every = 5000): Promise<T | null> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const value = await check();
    if (value) return value;
    await sleep(every);
  }
  return null;
}
