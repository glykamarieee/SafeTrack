import { reviewAnomaly } from "../_shared/anomaly.ts";
import { safeEqual } from "../_shared/crypto.ts";
import { json, options } from "../_shared/response.ts";
import { serviceClient } from "../_shared/supabase.ts";

// On-demand AI review of one stored location. Server-to-server only: it runs
// with the service role, so it is authenticated with x-cron-secret, never a
// user JWT. The app does not call it; scheduled-safety-scan does the routine
// reviews.
Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return options();
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const expectedSecret = Deno.env.get("CRON_SECRET") ?? "";
  const providedSecret = request.headers.get("x-cron-secret") ?? "";

  if (!expectedSecret || !safeEqual(providedSecret, expectedSecret)) {
    return json({ error: "Unauthorized request." }, 401);
  }

  try {
    const body = await request.json();

    const childId = String(body.childId ?? "").trim();
    const locationLogId = String(body.locationLogId ?? "").trim();

    if (!childId || !locationLogId) {
      return json(
        { error: "childId and locationLogId are required." },
        400,
      );
    }

    // reviewAnomaly ignores a location that does not belong to childId.
    await reviewAnomaly({
      supabase: serviceClient(),
      childId,
      locationLogId,
    });

    return json({
      success: true,
      message: "Anomaly review completed.",
    });
  } catch (error) {
    console.error("[anomaly-detection]", error);

    return json(
      {
        error: error instanceof Error
          ? error.message
          : "Anomaly detection failed.",
      },
      500,
    );
  }
});
