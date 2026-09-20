import type { SupabaseClient, User } from "npm:@supabase/supabase-js@2";

export async function requireUser(
  supabase: SupabaseClient,
  request: Request,
): Promise<User> {
  const authHeader = request.headers.get("Authorization") ?? "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!accessToken) throw new Error("AUTH_REQUIRED");

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) throw new Error("AUTH_INVALID");
  return user;
}

/**
 * Resolve the current SafeTrack Guardian profile.
 *
 * The live SafeTrack schema currently uses guardian_profiles.id as the
 * authenticated Guardian identifier. Email fallback keeps existing records
 * usable if an older migration produced a different id.
 */
export async function findGuardianProfile(
  supabase: SupabaseClient,
  user: User,
): Promise<any | null> {
  const direct = await supabase
    .from("guardian_profiles")
    .select("*")
    .eq("id", user.id)
    .limit(1)
    .maybeSingle();

  if (!direct.error && direct.data) return direct.data;

  if (user.email) {
    const byEmail = await supabase
      .from("guardian_profiles")
      .select("*")
      .eq("email", user.email)
      .limit(1)
      .maybeSingle();

    if (!byEmail.error && byEmail.data) return byEmail.data;
  }

  return null;
}

/** Resolve the current SafeTrack Administrator profile. */
export async function findAdminProfile(
  supabase: SupabaseClient,
  user: User,
): Promise<any | null> {
  const direct = await supabase
    .from("system_administrators")
    .select("*")
    .eq("id", user.id)
    .limit(1)
    .maybeSingle();

  if (!direct.error && direct.data) return direct.data;

  if (user.email) {
    const byEmail = await supabase
      .from("system_administrators")
      .select("*")
      .eq("email", user.email)
      .limit(1)
      .maybeSingle();

    if (!byEmail.error && byEmail.data) return byEmail.data;
  }

  return null;
}

export function assertActiveAdmin(admin: any) {
  if (!admin) throw new Error("ADMIN_REQUIRED");
  if (admin.is_active === false) throw new Error("ADMIN_INACTIVE");
}
