import { json, options } from "../_shared/response.ts";
import { findGuardianProfile, requireUser } from "../_shared/identity.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return options();

  try {
    const supabase = serviceClient();
    const user = await requireUser(supabase, request);
    const guardian = await findGuardianProfile(supabase, user);
    if (!guardian) return json({ error: "Guardian profile was not found." }, 403);

    const body = await request.json();
    const sosAlertId = String(body.sosAlertId ?? "").trim();
    if (!sosAlertId) return json({ error: "sosAlertId is required." }, 400);

    const { data: alert, error: lookupError } = await supabase
      .from("sos_alerts")
      .select("id, guardian_id, status")
      .eq("id", sosAlertId)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!alert || alert.guardian_id !== guardian.id) {
      return json({ error: "SOS alert was not found or is not authorized." }, 404);
    }

    if (alert.status !== "active") {
      return json({ ok: true, status: alert.status, alreadyClosed: true });
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("sos_alerts")
      .update({
        status: "acknowledged",
        acknowledged_at: now,
        acknowledged_by_person_id: guardian.id,
        updated_at: now,
      })
      .eq("id", sosAlertId)
      .eq("guardian_id", guardian.id)
      .eq("status", "active");

    if (error) throw error;
    return json({ ok: true, status: "acknowledged", acknowledgedAt: now });
  } catch (error) {
    console.error("[guardian-ack-sos]", error);
    const message = error instanceof Error ? error.message : "Unable to acknowledge SOS alert.";
    if (message === "AUTH_REQUIRED" || message === "AUTH_INVALID") {
      return json({ error: "Guardian authentication is required." }, 401);
    }
    return json({ error: message }, 500);
  }
});
