import { sha256, safeEqual } from "./crypto.ts";
import { serviceClient } from "./supabase.ts";

export async function authenticateWatch(request: Request) {
  const watchId = request.headers
    .get("x-watch-id")
    ?.trim()
    .toUpperCase();

  const deviceToken = request.headers
    .get("x-device-token")
    ?.trim();

  if (!watchId || !deviceToken) {
    throw new Error(
      "Missing smartwatch authentication.",
    );
  }

  const supabase = serviceClient();

  const { data: device, error } = await supabase
    .from("smartwatch_devices")
    .select(
      `
      id,
      watch_id,
      child_id,
      is_active,
      device_token_hash
      `,
    )
    .eq("watch_id", watchId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!device) {
    throw new Error(
      "Smartwatch is not registered.",
    );
  }

  if (!device.is_active) {
    throw new Error(
      "Smartwatch is disabled.",
    );
  }

  if (!device.child_id) {
    throw new Error(
      "Smartwatch is not linked to a child profile.",
    );
  }

  const storedHash =
    device.device_token_hash ?? "";

  if (!storedHash) {
    throw new Error(
      "Smartwatch session is not active. Pair the watch first.",
    );
  }

  const incomingHash =
    await sha256(deviceToken);

  if (!safeEqual(incomingHash, storedHash)) {
    throw new Error(
      "Smartwatch authentication failed.",
    );
  }

  return {
    supabase,
    device,
  };
}