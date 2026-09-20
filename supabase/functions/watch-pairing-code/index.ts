import {
  json,
  options,
} from "../_shared/response.ts";

import {
  randomSixDigitCode,
  sha256,
} from "../_shared/crypto.ts";

import {
  serviceClient,
} from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return options();
  }

  try {
    /*
     * =====================================================
     * 1. VERIFY THE GUARDIAN SESSION
     * =====================================================
     */

    const authHeader =
      request.headers.get("Authorization") ??
      "";

    const accessToken = authHeader
      .replace(/^Bearer\s+/i, "")
      .trim();

    if (!accessToken) {
      return json(
        {
          error:
            "Guardian authentication is required.",
        },
        401,
      );
    }

    const supabase = serviceClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(
      accessToken,
    );

    if (userError || !user) {
      return json(
        {
          error:
            "Invalid Guardian session.",
        },
        401,
      );
    }

    /*
     * =====================================================
     * 2. GET WATCH IDENTIFIER
     * =====================================================
     */

    const body =
      await request.json();

    const smartwatchDeviceId = String(
      body.smartwatchDeviceId ?? "",
    ).trim();

    const watchId = String(
      body.watchId ?? "",
    )
      .trim()
      .toUpperCase();

    if (
      !smartwatchDeviceId &&
      !watchId
    ) {
      return json(
        {
          error:
            "smartwatchDeviceId or watchId is required.",
        },
        400,
      );
    }

    /*
     * =====================================================
     * 3. LOAD SMARTWATCH DEVICE
     * =====================================================
     */

    let deviceQuery = supabase
      .from("smartwatch_devices")
      .select(
        `
        id,
        watch_id,
        child_id,
        child_person_id,
        is_active,
        paired_at,
        device_token_hash
        `,
      );

    if (smartwatchDeviceId) {
      deviceQuery =
        deviceQuery.eq(
          "id",
          smartwatchDeviceId,
        );
    } else {
      deviceQuery =
        deviceQuery.eq(
          "watch_id",
          watchId,
        );
    }

    const {
      data: device,
      error: deviceError,
    } = await deviceQuery
      .limit(1)
      .maybeSingle();

    if (deviceError) {
      throw deviceError;
    }

    if (!device) {
      return json(
        {
          error:
            "Smartwatch connection ID was not found.",
        },
        404,
      );
    }

    if (!device.is_active) {
      return json(
        {
          error:
            "This smartwatch is currently inactive.",
        },
        400,
      );
    }

    if (!device.child_id) {
      return json(
        {
          error:
            "The smartwatch has not yet been linked to a child.",
        },
        400,
      );
    }

    /*
     * =====================================================
     * 4. VERIFY THAT THE CHILD BELONGS TO THIS GUARDIAN
     * =====================================================
     */

    const {
      data: child,
      error: childError,
    } = await supabase
      .from("child_profiles")
      .select(
        `
        id,
        guardian_id,
        full_name
        `,
      )
      .eq(
        "id",
        device.child_id,
      )
      .maybeSingle();

    if (childError) {
      throw childError;
    }

    if (!child) {
      return json(
        {
          error:
            "The linked child profile could not be found.",
        },
        404,
      );
    }

    if (
      child.guardian_id !== user.id
    ) {
      return json(
        {
          error:
            "You are not authorized to generate a connection code for this smartwatch.",
        },
        403,
      );
    }

    /*
     * =====================================================
     * 5. GENERATE TEMPORARY 6-DIGIT CONNECTION CODE
     * =====================================================
     */

    const connectionCode =
      randomSixDigitCode();

    /*
     * Code remains valid for 10 minutes.
     */
    const expiresAtMs =
      Date.now() +
      10 * 60 * 1000;

    /*
     * Never save the plain 6-digit code in the database.
     *
     * Only its SHA-256 hash is stored.
     */
    const codeHash =
      await sha256(
        connectionCode,
      );

    /*
     * Temporary challenge format:
     *
     * pair:v1:<expiry timestamp>:<code hash>
     *
     * watch-pair/index.ts reads this challenge.
     */
    const challenge =
      `pair:v1:${expiresAtMs}:${codeHash}`;

    const now =
      new Date().toISOString();

    /*
     * During first-time pairing,
     * device_token_hash temporarily holds the pairing challenge.
     *
     * After the watch successfully enters the code,
     * watch-pair replaces this with the real hashed device token.
     */
    const {
      error: updateError,
    } = await supabase
      .from(
        "smartwatch_devices",
      )
      .update({
        device_token_hash:
          challenge,

        updated_at:
          now,
      })
      .eq(
        "id",
        device.id,
      );

    if (updateError) {
      throw updateError;
    }

    /*
     * =====================================================
     * 6. RETURN CODE TO GUARDIAN APP
     * =====================================================
     */

    return json({
      ok: true,

      connectionCode,

      expiresAt:
        new Date(
          expiresAtMs,
        ).toISOString(),

      watchId:
        device.watch_id,

      childId:
        child.id,

      childName:
        child.full_name,
    });
  } catch (error) {
    console.error(
      "[watch-pairing-code]",
      error,
    );

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate connection code.",
      },
      500,
    );
  }
});