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
    const pushToken = String(body.pushToken ?? "").trim();
    const platform = String(body.platform ?? "android").trim().slice(0, 30);
    const deviceName = String(body.deviceName ?? "").trim().slice(0, 160) || null;

    if (!pushToken.startsWith("ExponentPushToken[") && !pushToken.startsWith("ExpoPushToken[")) {
      return json({ error: "A valid Expo push token is required." }, 400);
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("guardian_push_tokens")
      .upsert(
        {
          guardian_id: guardian.id,
          push_token: pushToken,
          platform,
          device_name: deviceName,
          is_active: true,
          last_seen_at: now,
          updated_at: now,
        },
        { onConflict: "push_token" },
      )
      .select("id, push_token, is_active")
      .single();

    if (error) throw error;
    return json({ ok: true, token: data });
  } catch (error) {
    console.error("[guardian-register-push]", error);
    const message = error instanceof Error ? error.message : "Unable to register push notifications.";
    if (message === "AUTH_REQUIRED" || message === "AUTH_INVALID") {
      return json({ error: "Guardian authentication is required." }, 401);
    }
    return json({ error: message }, 500);
  }
});
