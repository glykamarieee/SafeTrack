import { json, options } from "../_shared/response.ts";
import { randomToken, safeEqual, sha256 } from "../_shared/crypto.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return options();
  }

  try {
    const body = await request.json();

    const connectionCode = String(body.connectionCode ?? "")
      .replace(/\D/g, "")
      .slice(0, 6);

    const watchId = String(body.watchId ?? "")
      .trim()
      .toUpperCase();

    if (connectionCode.length !== 6 || !watchId) {
      return json(
        {
          error: "Enter a valid 6-digit connection code and Watch ID.",
        },
        400,
      );
    }

    const supabase = serviceClient();

    const { data: device, error: deviceError } = await supabase
      .from("smartwatch_devices")
      .select(
        `
        id,
        child_id,
        watch_id,
        is_active,
        pairing_code_hash,
        pairing_code_expires_at
        `,
      )
      .eq("watch_id", watchId)
      .maybeSingle();

    if (deviceError) {
      throw deviceError;
    }

    if (!device) {
      return json(
        {
          error:
            "Smartwatch not found. Confirm the Watch ID from the Guardian app.",
        },
        404,
      );
    }

    if (!device.is_active || !device.child_id) {
      return json(
        {
          error:
            "This smartwatch is not active or is not linked to a child profile.",
        },
        403,
      );
    }

    if (
      !device.pairing_code_hash ||
      !device.pairing_code_expires_at
    ) {
      return json(
        {
          error:
            "No active connection code exists. Generate a new code from the Guardian app.",
        },
        400,
      );
    }

    const expiresAt = new Date(
      device.pairing_code_expires_at,
    ).getTime();

    if (
      !Number.isFinite(expiresAt) ||
      Date.now() > expiresAt
    ) {
      return json(
        {
          error:
            "Connection code expired. Generate a new code in the Guardian app.",
        },
        400,
      );
    }

    const incomingHash = await sha256(connectionCode);

    if (!safeEqual(incomingHash, device.pairing_code_hash)) {
      return json(
        {
          error:
            "Connection code is invalid for this smartwatch.",
        },
        403,
      );
    }

    const deviceToken = randomToken(32);
    const deviceTokenHash = await sha256(deviceToken);

    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("smartwatch_devices")
      .update({
        device_token_hash: deviceTokenHash,

        // connection code is one-time use only
        pairing_code_hash: null,
        pairing_code_expires_at: null,
        pairing_code_created_at: null,

        paired_at: now,
        last_verified_at: now,
        last_seen_at: now,
        updated_at: now,
      })
      .eq("id", device.id);

    if (updateError) {
      throw updateError;
    }

    const { data: child, error: childError } = await supabase
      .from("children")
      .select(
        `
        id,
        full_name,
        guardian_id
        `,
      )
      .eq("id", device.child_id)
      .maybeSingle();

    if (childError) {
      throw childError;
    }

    if (!child) {
      return json(
        {
          error:
            "Child profile could not be loaded.",
        },
        500,
      );
    }

    return json({
      ok: true,

      deviceId: device.id,

      childId: child.id,
      childName: child.full_name,

      watchId: device.watch_id,

      deviceToken,
    });
  } catch (error) {
    console.error(
      "[watch-pair]",
      error,
    );

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to pair smartwatch.",
      },
      500,
    );
  }
});