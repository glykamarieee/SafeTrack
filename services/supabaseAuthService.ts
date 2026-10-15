import type { Session, User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import { supabase } from "../lib/supabase";

/**
 * Where email links (sign-up confirmation, password reset) return to: the
 * `safetrack://` scheme in a build, the site origin on web, `exp://…` in Expo
 * Go. Each must be listed under Supabase → Authentication → URL Configuration
 * → Redirect URLs.
 */
export function authRedirectUrl(path: "/login" | "/reset-password") {
  return Linking.createURL(path);
}

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
  is_active: boolean | null;
};

/** A deleted (or administrator-deactivated) account trying to sign in. */
export class InactiveAccountError extends Error {
  constructor() {
    super("This account was deleted or turned off, so it can't sign in. Create a new account to use SafeTrack again.");
    this.name = "InactiveAccountError";
  }
}

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

const DELETED_ACCOUNT_MESSAGE =
  "This account was deleted or turned off, so it can't sign in. Create a new account to use SafeTrack again.";

function getSafeErrorMessage(message: string, status?: number) {
  const normalized = (message ?? "").toLowerCase();

  // Supabase answers the same way for an unknown email and a wrong password.
  if (normalized.includes("invalid login credentials")) {
    return "No account matches this email and password. Check them, or create a new account.";
  }

  // Deleted accounts are banned by delete_my_account().
  if (normalized.includes("banned")) {
    return DELETED_ACCOUNT_MESSAGE;
  }

  if (normalized.includes("fetch failed") || normalized.includes("network request failed") || normalized.includes("connection reset")) {
    return "SafeTrack can't reach its server. Check your internet connection (some mobile networks block it; try Wi-Fi or another network) and try again.";
  }

  // Server errors arrive as raw JSON or "Database error ..." text; never show
  // those. A 500 at sign-in comes from an account that was deleted before the
  // 20261016b fix.
  if ((status ?? 0) >= 500 || normalized.startsWith("{") || normalized.includes("database error") || normalized.includes("unexpected_failure")) {
    return "SafeTrack couldn't sign in to this account. If it was deleted, create a new account; otherwise try again in a moment.";
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
    .select("id,auth_user_id,full_name,email,is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (personError) {
    throw new Error(personError.message);
  }

  if (!personData) {
    return null;
  }

  const person = personData as PersonRow;

  // Deleted accounts keep their row (soft delete); never let them back in or
  // let ensure_guardian_profile re-provision them.
  if (person.is_active === false) {
    await supabase.auth.signOut().catch(() => undefined);
    throw new InactiveAccountError();
  }

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
    throw new Error(getSafeErrorMessage(authError.message, authError.status));
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
      // The confirmation link (when email confirmation is on) returns here.
      emailRedirectTo: authRedirectUrl("/login"),
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
    normalizedEmail,
    { redirectTo: authRedirectUrl("/reset-password") }
  );

  if (error) {
    // A 500 here means Supabase could not send the email (SMTP settings);
    // the raw error is a JSON blob, not something to show a user.
    if ((error as { status?: number }).status === 500 || /sending|smtp|{"status"/i.test(error.message)) {
      throw new Error("The reset email could not be sent right now. Please try again later.");
    }
    if ((error as { status?: number }).status === 429 || /rate limit/i.test(error.message)) {
      throw new Error("Too many reset requests. Please wait a few minutes and try again.");
    }
    throw new Error(getSafeErrorMessage(error.message));
  }
}

/** Sends the sign-up confirmation email again. */
export async function resendVerificationEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: authRedirectUrl("/login") },
  });

  if (error) {
    throw new Error(getSafeErrorMessage(error.message));
  }
}

/**
 * Turns the link from a password-reset email into a session, so the new
 * password can be saved. Handles both link styles Supabase sends:
 * `#access_token=…&refresh_token=…&type=recovery` and `?code=…`.
 */
export async function startPasswordRecovery(url: string): Promise<void> {
  const [beforeHash, hash = ""] = url.split("#");
  const query = beforeHash!.includes("?") ? beforeHash!.split("?")[1]! : "";
  const params = new URLSearchParams(`${query}&${hash}`);

  const failure = params.get("error_description") ?? params.get("error");
  if (failure) {
    throw new Error(
      /expired|invalid/i.test(failure)
        ? "This reset link has expired or was already used. Request a new one."
        : failure.replaceAll("+", " ")
    );
  }

  const code = params.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw new Error("This reset link has expired or was already used. Request a new one.");
    return;
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw new Error("This reset link has expired or was already used. Request a new one.");
    return;
  }

  throw new Error("Open the reset link from your email on this device.");
}

export const MIN_PASSWORD_LENGTH = 8;

export function passwordProblem(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password !== confirm) return "The passwords do not match.";

  return null;
}

/** Saves a new password for the signed-in user (after recovery or re-authentication). */
export async function updateMyPassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    throw new Error(
      /different from the old|same password/i.test(error.message)
        ? "The new password must be different from the current one."
        : getSafeErrorMessage(error.message)
    );
  }
}

/**
 * Confirms the current password before a sensitive change. Signing in again
 * with the same account keeps the session.
 */
export async function verifyCurrentPassword(password: string): Promise<void> {
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;

  if (!email) throw new Error("Your session has expired. Log in again.");

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    throw new Error(
      /invalid login credentials/i.test(error.message)
        ? "The current password is incorrect."
        : getSafeErrorMessage(error.message)
    );
  }
}

export async function changeMyPassword(currentPassword: string, newPassword: string): Promise<void> {
  await verifyCurrentPassword(currentPassword);
  await updateMyPassword(newPassword);
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    // supabase-js keeps the saved session when the server call fails (e.g.
    // offline), so the old account would be restored on the next launch.
    // Always clear this device's session; the server one simply expires.
    await supabase.auth.signOut({ scope: "local" });
  }
}

export async function signOutSafeTrackUser(): Promise<void> {
  await signOut();
}