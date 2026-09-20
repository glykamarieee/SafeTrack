import { sha256, safeEqual } from "./crypto.ts";
import { serviceClient } from "./supabase.ts";

export async function authenticateWatch(request: Request) {
  const watchId = request.headers.get("x-watch-id")?.trim();
  const deviceToken = request.headers.get("x-device-token")?.trim();

  if (!watchId || !deviceToken) {
    throw new Error("Missing smartwatch authentication.");
  }

  const supabase = serviceClient();

  const { data: device, error } = await supabase
    .from("smartwatch_devices")
    .select("id, watch_id, child_id, child_person_id, is_active, device_token_hash")
    .eq("watch_id", watchId)
    .maybeSingle();

  if (error) throw error;
  if (!device) throw new Error("Smartwatch is not registered.");
  if (!device.is_active) throw new Error("Smartwatch is disabled.");

  const storedHash = device.device_token_hash ?? "";
  if (!storedHash || storedHash.startsWith("pair:v1:")) {
    throw new Error("Smartwatch session is not active. Pair the watch again.");
  }

  const incomingHash = await sha256(deviceToken);

  if (!safeEqual(incomingHash, storedHash)) {
    throw new Error("Smartwatch authentication failed.");
  }

  if (!device.child_id) {
    throw new Error("Smartwatch is not linked to a child profile.");
  }

  return { supabase, device };
}
