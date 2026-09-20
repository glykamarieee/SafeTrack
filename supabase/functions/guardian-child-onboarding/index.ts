import { json, options } from "../_shared/response.ts";
import { randomSixDigitCode, sha256 } from "../_shared/crypto.ts";
import { findGuardianProfile, requireUser } from "../_shared/identity.ts";
import { serviceClient } from "../_shared/supabase.ts";

const WATCH_ID_PATTERN = /^ST-WATCH-[A-Z0-9]{6,32}$/;

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return options();

  const supabase = serviceClient();
  let createdChildId: string | null = null;

  try {
    const user = await requireUser(supabase, request);
    const guardian = await findGuardianProfile(supabase, user);

    if (!guardian) {
      return json({ error: "Guardian profile was not found." }, 403);
    }

    const body = await request.json();
    const fullName = String(body.fullName ?? "").trim();
    const age = Number(body.age);
    const relationship = String(body.relationship ?? "Guardian").trim();
    const trackingSource = String(body.trackingSource ?? "smartwatch").trim();
    const watchId = String(body.watchId ?? "").trim().toUpperCase();

    if (fullName.length < 2) {
      return json({ error: "Enter the child's full name." }, 400);
    }

    if (!Number.isInteger(age) || age < 6 || age > 15) {
      return json({ error: "SafeTrack is scoped for children aged 6 to 15." }, 400);
    }

    if (!["smartwatch", "both"].includes(trackingSource)) {
      return json(
        { error: "A registered smartwatch is required. Mobile-only tracking is not allowed." },
        400,
      );
    }

    if (!WATCH_ID_PATTERN.test(watchId)) {
      return json(
        { error: "Enter the Watch ID shown by the SafeTrack Wear OS app (ST-WATCH-...)." },
        400,
      );
    }

    // Validate device ownership/link state before creating the child record.
    const { data: existingDevice, error: existingDeviceError } = await supabase
      .from("smartwatch_devices")
      .select("id, watch_id, child_id, is_active")
      .eq("watch_id", watchId)
      .maybeSingle();

    if (existingDeviceError) throw existingDeviceError;

    if (existingDevice?.child_id) {
      return json(
        {
          error:
            "This smartwatch is already linked to a child. Use Generate Child Device Connection Code from the existing child/device screen instead of registering another child.",
        },
        409,
      );
    }

    const { data: child, error: childError } = await supabase
      .from("child_profiles")
      .insert({
        guardian_id: guardian.id,
        full_name: fullName,
        age,
        relationship,
        tracking_source: trackingSource,
      })
      .select("id, guardian_id, full_name, age, relationship, tracking_source")
      .single();

    if (childError) throw childError;
    createdChildId = child.id;

    const now = new Date();

    let device: any;

    if (existingDevice) {
      const { data, error } = await supabase
        .from("smartwatch_devices")
        .update({
          child_id: child.id,
          child_person_id: child.id,
          is_active: true,
          updated_at: now.toISOString(),
        })
        .eq("id", existingDevice.id)
        .select("id, watch_id, child_id, is_active")
        .single();

      if (error) throw error;
      device = data;
    } else {
      const { data, error } = await supabase
        .from("smartwatch_devices")
        .insert({
          watch_id: watchId,
          child_id: child.id,
          child_person_id: child.id,
          is_active: true,
        })
        .select("id, watch_id, child_id, is_active")
        .single();

      if (error) throw error;
      device = data;
    }

    // Generate the first one-time verification code immediately so Guardian
    // registration never redirects to Home while the watch is still blocked.
    const connectionCode = randomSixDigitCode();
    const codeHash = await sha256(connectionCode);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const { error: challengeError } = await supabase
      .from("smartwatch_devices")
      .update({
        pairing_code_hash: codeHash,
        pairing_code_created_at: now.toISOString(),
        pairing_code_expires_at: expiresAt.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", device.id);

    if (challengeError) throw challengeError;

    return json({
      ok: true,
      child,
      device: {
        ...device,
        watch_id: watchId,
      },
      connectionCode,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("[guardian-child-onboarding]", error);

    // Best-effort rollback for the only cross-table step that is not atomic via
    // PostgREST. Do not leave an orphan child if device linking fails.
    if (createdChildId) {
      await supabase
        .from("smartwatch_devices")
        .update({ child_id: null, child_person_id: null })
        .eq("child_id", createdChildId);
      await supabase.from("child_profiles").delete().eq("id", createdChildId);
    }

    const message = error instanceof Error ? error.message : "Unable to complete child registration.";
    if (message === "AUTH_REQUIRED" || message === "AUTH_INVALID") {
      return json({ error: "Guardian authentication is required." }, 401);
    }
    return json({ error: message }, 500);
  }
});
