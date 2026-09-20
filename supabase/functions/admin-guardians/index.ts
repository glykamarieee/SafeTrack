import { json, options } from "../_shared/response.ts";
import { assertActiveAdmin, findAdminProfile, requireUser } from "../_shared/identity.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return options();

  try {
    const supabase = serviceClient();
    const user = await requireUser(supabase, request);
    const admin = await findAdminProfile(supabase, user);
    assertActiveAdmin(admin);

    const body = request.method === "GET" ? {} : await request.json().catch(() => ({}));
    const action = String(body.action ?? "list");

    if (action === "list") {
      const { data: guardians, error } = await supabase
        .from("guardian_profiles")
        .select("id, full_name, email, account_status, is_active, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return json({
        ok: true,
        guardians: (guardians ?? []).map((guardian: any) => ({
          id: guardian.id,
          personId: null,
          fullName: guardian.full_name ?? "Guardian",
          email: guardian.email ?? null,
          isActive: guardian.is_active !== false && guardian.account_status !== "inactive",
          accountStatus: guardian.account_status ?? (guardian.is_active === false ? "inactive" : "active"),
          createdAt: guardian.created_at ?? null,
          updatedAt: guardian.updated_at ?? null,
        })),
      });
    }

    if (action === "set_status") {
      const guardianId = String(body.guardianId ?? "").trim();
      const isActive = Boolean(body.isActive);
      if (!guardianId) return json({ error: "guardianId is required." }, 400);

      const { data: guardian, error: guardianError } = await supabase
        .from("guardian_profiles")
        .select("id, email")
        .eq("id", guardianId)
        .maybeSingle();

      if (guardianError) throw guardianError;
      if (!guardian) return json({ error: "Guardian was not found." }, 404);

      const now = new Date().toISOString();
      const { error: updateGuardianError } = await supabase
        .from("guardian_profiles")
        .update({
          is_active: isActive,
          account_status: isActive ? "active" : "inactive",
          updated_at: now,
        })
        .eq("id", guardianId);

      if (updateGuardianError) throw updateGuardianError;

      // In the current SafeTrack build guardian_profiles.id is normally the
      // auth.users.id. If an older record differs, resolve by email through the
      // shared persons table before changing Supabase Auth status.
      let authUserId: string | null = guardianId;

      const { data: directUser } = await supabase.auth.admin.getUserById(guardianId);
      if (!directUser?.user && guardian.email) {
        const { data: person } = await supabase
          .from("persons")
          .select("id, auth_user_id")
          .eq("email", guardian.email)
          .limit(1)
          .maybeSingle();

        if (person?.auth_user_id) authUserId = person.auth_user_id;
      }

      if (authUserId) {
        const { error: authError } = await supabase.auth.admin.updateUserById(
          authUserId,
          { ban_duration: isActive ? "none" : "876000h" },
        );
        if (authError) throw authError;
      }

      return json({
        ok: true,
        guardianId,
        isActive,
        accountStatus: isActive ? "active" : "inactive",
      });
    }

    return json({ error: "Unsupported admin guardian action." }, 400);
  } catch (error) {
    console.error("[admin-guardians]", error);
    const message = error instanceof Error ? error.message : "Admin guardian operation failed.";
    if (["AUTH_REQUIRED", "AUTH_INVALID"].includes(message)) {
      return json({ error: "Administrator authentication is required." }, 401);
    }
    if (["ADMIN_REQUIRED", "ADMIN_INACTIVE"].includes(message)) {
      return json({ error: "Active Administrator access is required." }, 403);
    }
    return json({ error: message }, 500);
  }
});
