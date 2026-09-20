import { json, options } from "../_shared/response.ts";
import { sendGuardianPush } from "../_shared/push.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return options();

  try {
    const expectedSecret = Deno.env.get("CRON_SECRET");
    const providedSecret = request.headers.get("x-cron-secret");

    if (!expectedSecret || providedSecret !== expectedSecret) {
      return json({ error: "Unauthorized scheduled request." }, 401);
    }

    const supabase = serviceClient();

    const intervalSeconds = Number(
      Deno.env.get("SOS_REALERT_SECONDS") ?? "120",
    );

    const maxRealerts = Number(
      Deno.env.get("SOS_MAX_REALERTS") ?? "10",
    );

    const threshold = new Date(
      Date.now() - intervalSeconds * 1000,
    ).toISOString();

    const { data: alerts, error } = await supabase
      .from("sos_alerts")
      .select(
        "id, child_id, guardian_id, realert_count, last_realert_at, triggered_at",
      )
      .eq("status", "active")
      .lt("realert_count", maxRealerts);

    if (error) throw error;

    let sent = 0;

    for (const alert of alerts ?? []) {
      const comparison =
        alert.last_realert_at ?? alert.triggered_at;

      if (comparison && comparison > threshold) continue;

      const { data: child } = await supabase
        .from("child_profiles")
        .select("full_name")
        .eq("id", alert.child_id)
        .maybeSingle();

      const nextCount = Number(alert.realert_count ?? 0) + 1;
      const now = new Date().toISOString();

      const { error: updateError } = await supabase
        .from("sos_alerts")
        .update({
          realert_count: nextCount,
          last_realert_at: now,
          updated_at: now,
        })
        .eq("id", alert.id)
        .eq("status", "active");

      if (updateError) {
        console.error("SOS re-alert update failed", updateError);
        continue;
      }

      await sendGuardianPush(
        supabase,
        alert.guardian_id,
        "SafeTrack SOS re-alert",
        `${child?.full_name ?? "Child"} has an active SOS alert awaiting acknowledgement.`,
        {
          type: "sos_realert",
          sosAlertId: alert.id,
          childId: alert.child_id,
          realertCount: nextCount,
        },
      );

      sent += 1;
    }

    return json({ ok: true, sent });
  } catch (error) {
    console.error(error);
    return json(
      { error: error instanceof Error ? error.message : "SOS re-alert processing failed." },
      500,
    );
  }
});
