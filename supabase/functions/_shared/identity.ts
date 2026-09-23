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

type Person = {
  id: string;
  auth_user_id: string;
  full_name: string;
  email: string | null;
  is_active: boolean;
};

/**
 * Resolve the signed-in user's persons row if it holds the given role.
 * persons.id equals auth.users.id for everyone who can log in.
 */
async function findPersonWithRole(
  supabase: SupabaseClient,
  user: User,
  roleCode: "ADMIN",
): Promise<Person | null> {
  const { data, error } = await supabase
    .from("persons")
    .select("id, auth_user_id, full_name, email, is_active, person_roles!inner(is_active, roles!inner(role_code))")
    .eq("auth_user_id", user.id)
    .eq("person_roles.is_active", true)
    .eq("person_roles.roles.role_code", roleCode)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const { person_roles: _roles, ...person } = data as Person & { person_roles: unknown };
  return person;
}

/** Resolve the current SafeTrack Administrator (active or not). */
export async function findAdminProfile(
  supabase: SupabaseClient,
  user: User,
): Promise<Person | null> {
  return findPersonWithRole(supabase, user, "ADMIN");
}

export function assertActiveAdmin(admin: Person | null) {
  if (!admin) throw new Error("ADMIN_REQUIRED");
  if (admin.is_active === false) throw new Error("ADMIN_INACTIVE");
}
