import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export type SafeTrackRole = "admin" | "guardian";

export type SafeTrackPerson = {
  id: string;
  authUserId: string;
  fullName: string;
  email: string;
  role: SafeTrackRole | null;
};

export type SafeTrackSignInResult = {
  user: User;
  authUser: User;
  session: Session | null;
  person: SafeTrackPerson | null;
  role: SafeTrackRole | null;
};

type PersonRow = {
  id: string;
  auth_user_id: string;
  full_name: string | null;
  email: string | null;
};

type PersonRoleRow = {
  roles?:
    | {
        role_code?: unknown;
      }
    | {
        role_code?: unknown;
      }[]
    | null;
};

function getSafeErrorMessage(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Invalid email or password.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Please confirm your email address before logging in.";
  }

  if (normalized.includes("user already registered")) {
    return "An account with this email address already exists.";
  }

  return message;
}

function normalizeRoleCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");
}

function resolveSafeTrackRole(
  roleCodes: string[]
): SafeTrackRole | null {
  const normalizedCodes = roleCodes.map(normalizeRoleCode);

  if (
    normalizedCodes.includes("admin") ||
    normalizedCodes.includes("administrator") ||
    normalizedCodes.includes("system_administrator")
  ) {
    return "admin";
  }

  if (
    normalizedCodes.includes("guardian") ||
    normalizedCodes.includes("parent") ||
    normalizedCodes.includes("caregiver")
  ) {
    return "guardian";
  }

  return null;
}

function extractRoleCodes(rows: PersonRoleRow[]) {
  const codes: string[] = [];

  for (const row of rows) {
    if (Array.isArray(row.roles)) {
      for (const role of row.roles) {
        if (typeof role?.role_code === "string") {
          codes.push(role.role_code);
        }
      }

      continue;
    }

    if (typeof row.roles?.role_code === "string") {
      codes.push(row.roles.role_code);
    }
  }

  return codes;
}

async function findPersonForUser(
  user: User
): Promise<SafeTrackPerson | null> {
  const { data: personData, error: personError } = await supabase
    .from("persons")
    .select("id,auth_user_id,full_name,email")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (personError) {
    throw new Error(personError.message);
  }

  if (!personData) {
    return null;
  }

  const person = personData as PersonRow;

  const { data: roleData, error: roleError } = await supabase
    .from("person_roles")
    .select("roles!inner(role_code)")
    .eq("person_id", person.id)
    .eq("is_active", true);

  if (roleError) {
    throw new Error(roleError.message);
  }

  const roleCodes = extractRoleCodes(
    (roleData ?? []) as unknown as PersonRoleRow[]
  );

  return {
    id: String(person.id),
    authUserId: String(person.auth_user_id),
    fullName:
      person.full_name?.trim() ||
      String(user.user_metadata?.full_name ?? "SafeTrack User"),
    email: person.email?.trim() || user.email || "",
    role: resolveSafeTrackRole(roleCodes),
  };
}

export async function signInWithPassword(
  email: string,
  password: string
): Promise<SafeTrackSignInResult> {
  const normalizedEmail = email.trim().toLowerCase();

  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

  if (authError) {
    throw new Error(getSafeErrorMessage(authError.message));
  }

  if (!authData.user) {
    throw new Error("SafeTrack could not verify your account.");
  }

  const person = await findPersonForUser(authData.user);

  return {
    user: authData.user,
    authUser: authData.user,
    session: authData.session,
    person,
    role: person?.role ?? null,
  };
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message);
  }

  return data.session;
}

export async function getCurrentSafeTrackAccount(): Promise<SafeTrackSignInResult | null> {
  const session = await getCurrentSession();

  if (!session?.user) {
    return null;
  }

  const person = await findPersonForUser(session.user);

  return {
    user: session.user,
    authUser: session.user,
    session,
    person,
    role: person?.role ?? null,
  };
}

export async function signUpGuardian(
  fullName: string,
  email: string,
  password: string
) {
  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: {
        full_name: fullName.trim(),
      },
    },
  });

  if (error) {
    throw new Error(getSafeErrorMessage(error.message));
  }

  return data;
}

export async function sendPasswordReset(
  email: string
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();

  const { error } = await supabase.auth.resetPasswordForEmail(
    normalizedEmail
  );

  if (error) {
    throw new Error(getSafeErrorMessage(error.message));
  }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
}

export async function signOutSafeTrackUser(): Promise<void> {
  await signOut();
}