import { json, options } from "../_shared/response.ts";
import { randomToken, safeEqual, sha256 } from "../_shared/crypto.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return options();

  try {
    const body = await request.json();

    const connectionCode = String(body.connectionCode ?? "")
      .replace(/\D/g, "")
      .slice(0, 6);

    const watchId = String(body.watchId ?? "").trim().toUpperCase();

    if (connectionCode.length !== 6 || !watchId) {
      return json({ error: "Enter a valid 6-digit connection code." }, 400);
    }

    const supabase = serviceClient();

    const { data: device, error: deviceError } = await supabase
      .from("smartwatch_devices")
      .select("id, child_id, watch_id, is_active, device_token_hash")
      .eq("watch_id", watchId)
      .maybeSingle();

    if (deviceError) throw deviceError;

    if (!device || !device.is_active || !device.child_id) {
      return json({ error: "Device verification failed. Confirm the Watch ID in the Guardian app." }, 403);
    }

    const challenge = String(device.device_token_hash ?? "");
    const parts = challenge.split(":");

    if (parts.length !== 4 || parts[0] !== "pair" || parts[1] !== "v1") {
      return json({ error: "No active connection code exists for this smartwatch." }, 400);
    }

    const expiresAt = Number(parts[2]);
    const expectedHash = parts[3];

    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
      return json({ error: "Connection code expired. Generate a new code in the Guardian app." }, 400);
    }

    const incomingHash = await sha256(connectionCode);

    if (!safeEqual(incomingHash, expectedHash)) {
      return json({ error: "Connection code is invalid for this registered smartwatch." }, 403);
    }

    const deviceToken = randomToken(32);
    const tokenHash = await sha256(deviceToken);
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("smartwatch_devices")
      .update({
        device_token_hash: tokenHash,
        paired_at: now,
        last_verified_at: now,
        last_seen_at: now,
        updated_at: now,
      })
      .eq("id", device.id);

    if (updateError) throw updateError;

    const { data: child, error: childError } = await supabase
      .from("child_profiles")
      .select("id, full_name, guardian_id")
      .eq("id", device.child_id)
      .maybeSingle();

    if (childError) throw childError;
    if (!child) return json({ error: "Child profile could not be loaded." }, 500);

    return json({
      ok: true,
      deviceId: device.id,
      childId: child.id,
      childName: child.full_name,
      watchId: device.watch_id,
      deviceToken,
    });
  } catch (error) {
    console.error(error);
    return json(
      { error: error instanceof Error ? error.message : "Unable to pair smartwatch." },
      500,
    );
  }
});
