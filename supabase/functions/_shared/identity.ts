import type {
  SupabaseClient,
  User,
} from "npm:@supabase/supabase-js@2";

type SafeTrackPerson = {
  id: string;
  auth_user_id: string | null;
  full_name: string | null;
  email: string | null;
  is_active: boolean;
};

function normalizeRoleCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");
}

export async function requireUser(
  supabase: SupabaseClient,
  request: Request,
): Promise<User> {
  const authHeader =
    request.headers.get("Authorization") ?? "";

  const accessToken = authHeader
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!accessToken) {
    throw new Error("AUTH_REQUIRED");
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    throw new Error("AUTH_INVALID");
  }

  return user;
}

async function findPersonForUser(
  supabase: SupabaseClient,
  user: User,
): Promise<SafeTrackPerson | null> {
  //
  // Primary SafeTrack identity lookup.
  //
  const {
    data,
    error,
  } = await supabase
    .from("persons")
    .select(
      "id, auth_user_id, full_name, email, is_active",
    )
    .eq("auth_user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return data as SafeTrackPerson;
  }

  //
  // Compatibility fallback using email.
  //
  if (user.email) {
    const {
      data: byEmail,
      error: emailError,
    } = await supabase
      .from("persons")
      .select(
        "id, auth_user_id, full_name, email, is_active",
      )
      .eq(
        "email",
        user.email.trim(),
      )
      .limit(1)
      .maybeSingle();

    if (emailError) {
      throw emailError;
    }

    if (byEmail) {
      return byEmail as SafeTrackPerson;
    }
  }

  return null;
}

async function personHasRole(
  supabase: SupabaseClient,
  personId: string,
  acceptedRoleCodes: string[],
): Promise<boolean> {
  //
  // Query person_roles separately.
  //
  // This avoids ambiguous embedding because
  // both person_id and assigned_by_person_id
  // reference persons.
  //
  const {
    data: personRoles,
    error: personRolesError,
  } = await supabase
    .from("person_roles")
    .select(
      "role_id, is_active",
    )
    .eq(
      "person_id",
      personId,
    )
    .eq(
      "is_active",
      true,
    );

  if (personRolesError) {
    throw personRolesError;
  }

  const roleIds = [
    ...new Set(
      (personRoles ?? [])
        .map(
          (
            row: {
              role_id?: string | null;
            },
          ) => row.role_id,
        )
        .filter(
          (
            roleId,
          ): roleId is string =>
            typeof roleId === "string" &&
            roleId.length > 0,
        ),
    ),
  ];

  if (roleIds.length === 0) {
    return false;
  }

  //
  // Retrieve roles in a separate query.
  //
  const {
    data: roles,
    error: rolesError,
  } = await supabase
    .from("roles")
    .select(
      "id, role_code, is_active",
    )
    .in(
      "id",
      roleIds,
    )
    .eq(
      "is_active",
      true,
    );

  if (rolesError) {
    throw rolesError;
  }

  const accepted =
    acceptedRoleCodes.map(
      normalizeRoleCode,
    );

  return (roles ?? []).some(
    (
      role: {
        role_code?: unknown;
      },
    ) =>
      accepted.includes(
        normalizeRoleCode(
          role.role_code,
        ),
      ),
  );
}

/**
 * Resolve the current SafeTrack Guardian.
 *
 * SafeTrack identity is consolidated on persons.
 * Guardian authorization is verified using
 * person_roles -> roles.
 */
export async function findGuardianProfile(
  supabase: SupabaseClient,
  user: User,
): Promise<any | null> {
  const person =
    await findPersonForUser(
      supabase,
      user,
    );

  if (!person) {
    return null;
  }

  const hasGuardianRole =
    await personHasRole(
      supabase,
      person.id,
      [
        "GUARDIAN",
        "PARENT",
        "CAREGIVER",
      ],
    );

  if (!hasGuardianRole) {
    return null;
  }

  return {
    id: person.id,
    person_id: person.id,
    auth_user_id:
      person.auth_user_id,
    full_name:
      person.full_name,
    email:
      person.email,
    is_active:
      person.is_active !== false,
    role:
      "GUARDIAN",
  };
}

/**
 * Resolve the current SafeTrack Administrator.
 *
 * The live SafeTrack database uses persons
 * as the administrator identity source.
 *
 * No system_administrators table is required.
 */
export async function findAdminProfile(
  supabase: SupabaseClient,
  user: User,
): Promise<any | null> {
  const person =
    await findPersonForUser(
      supabase,
      user,
    );

  if (!person) {
    return null;
  }

  const hasAdminRole =
    await personHasRole(
      supabase,
      person.id,
      [
        "ADMIN",
        "ADMINISTRATOR",
        "SYSTEM_ADMINISTRATOR",
      ],
    );

  if (!hasAdminRole) {
    return null;
  }

  return {
    //
    // IMPORTANT:
    //
    // This is persons.id.
    // activity_reports.created_by_admin_id
    // also references persons.id.
    //
    id: person.id,

    person_id:
      person.id,

    auth_user_id:
      person.auth_user_id,

    full_name:
      person.full_name,

    email:
      person.email,

    is_active:
      person.is_active !== false,

    role:
      "ADMIN",
  };
}

export function assertActiveAdmin(
  admin: any,
) {
  if (!admin) {
    throw new Error(
      "ADMIN_REQUIRED",
    );
  }

  if (
    admin.is_active === false
  ) {
    throw new Error(
      "ADMIN_INACTIVE",
    );
  }
}