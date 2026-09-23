import { createClient } from "npm:@supabase/supabase-js@2";

import { reviewAnomaly } from "../_shared/anomaly.ts";
import { json, options } from "../_shared/response.ts";

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return options();
  }

  if (request.method !== "POST") {
    return json(
      {
        error: "Method not allowed.",
      },
      405,
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json(
        {
          error: "Supabase environment variables are missing.",
        },
        500,
      );
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
        },
      },
    );

    const body = await request.json();

    const childId = String(body.childId ?? "").trim();
    const guardianId = String(body.guardianId ?? "").trim();
    const locationLogId = String(body.locationLogId ?? "").trim();

    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);

    const recordedAt =
      typeof body.recordedAt === "string" && body.recordedAt
        ? body.recordedAt
        : new Date().toISOString();

    if (!childId || !guardianId || !locationLogId) {
      return json(
        {
          error:
            "childId, guardianId, and locationLogId are required.",
        },
        400,
      );
    }

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return json(
        {
          error: "Invalid latitude or longitude.",
        },
        400,
      );
    }

    await reviewAnomaly({
      supabase,
      childId,
      guardianId,
      locationLogId,
      latitude,
      longitude,
      recordedAt,
    });

    return json({
      success: true,
      message: "Anomaly review completed.",
    });
  } catch (error) {
    console.error(
      "[anomaly-detection]",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Anomaly detection failed.";

    return json(
      {
        error: message,
      },
      500,
    );
  }
});