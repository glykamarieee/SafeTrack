/**
 * Integration testing: Authentication with Dashboard Management, Administrator
 * Dashboard and User Settings (live backend, through the app's services).
 */
import { createClient } from "@supabase/supabase-js";

import { supabase } from "../../lib/supabase";
import { fetchAdminGuardianAccounts, fetchAdminSummaryMetrics, updateAdminGuardianAccountStatus } from "../../services/adminService";
import { fetchGuardianDashboardSummary, fetchGuardianProfile } from "../../services/guardianService";
import { fetchLatestLocationForChild } from "../../services/locationService";
import { updateGuardianProfile } from "../../services/profileService";
import { changeMyPassword, sendPasswordReset, signUpGuardian } from "../../services/supabaseAuthService";
import { useAuthStore } from "../../store/authStore";
import { accounts } from "../setup/accounts";
import { recordActual } from "../setup/record";
import { signInAs, signOutLocally } from "../setup/session";
import { MODULE } from "./helpers";

const A = accounts as any;
const state = () => useAuthStore.getState();
/** Where the Login screen sends the user (app/(auth)/login.tsx). */
const landing = () => (state().role === "admin" ? "Administrator Dashboard" : state().linkedChildren.length ? "Guardian Home" : "Register your child");

/** A separate sign-in, as another device would do, without touching the app session. */
async function trySignIn(email: string, password: string) {
  const c = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  return error?.message ?? "signed in";
}

afterAll(async () => {
  await signOutLocally();
});

describe("Authentication with the dashboards", () => {
  test("INT-001: Guardian login opens the Guardian dashboard with the child's data", async () => {
    await signInAs(A.guardianWithChild);
    expect(state().role).toBe("guardian");
    const summary: any = await fetchGuardianDashboardSummary(state().guardian!.id);
    const children = state().linkedChildren;
    expect(children.length).toBeGreaterThan(0);
    const latest = await fetchLatestLocationForChild(children[children.length - 1].id);
    expect(landing()).toBe("Guardian Home");
    recordActual(MODULE, "INT-001", `Login succeeded as a guardian and routed to ${landing()}; the dashboard loaded ${children.length} linked children (${children.map((c: any) => c.fullName ?? c.full_name).join(", ")}) and the latest location of ${(children[children.length - 1] as any).fullName ?? (children[children.length - 1] as any).full_name} (${latest ? `${latest.latitude.toFixed(5)}, ${latest.longitude.toFixed(5)}` : "none"}).`);
    void summary;
  });

  test("INT-002: Administrator login opens the Administrator dashboard with system totals", async () => {
    await signInAs(A.admin);
    expect(state().role).toBe("admin");
    const m: any = await fetchAdminSummaryMetrics();
    expect(landing()).toBe("Administrator Dashboard");
    const totals = Object.entries(m).filter(([, v]) => typeof v === "number").map(([k, v]) => `${k} ${v}`).join(", ");
    recordActual(MODULE, "INT-002", `Login succeeded as an administrator and routed to the ${landing()}; the overview totals were returned from the database (${totals}).`);
  });

  test("INT-003: Password changed in Profile is the one that signs in", async () => {
    const acc = A.verifyAccount;
    const temporary = `${acc.password}9#`;
    await signInAs(acc);
    try {
      await changeMyPassword(acc.password, temporary);
      expect(await trySignIn(acc.email, temporary)).toBe("signed in");
      expect(await trySignIn(acc.email, acc.password)).toMatch(/invalid login credentials/i);
      recordActual(MODULE, "INT-003", "Change password saved the new password; signing in with the new password succeeded and the old password was refused (\"Invalid login credentials\"). The original password was restored after the test.");
    } finally {
      await changeMyPassword(temporary, acc.password).catch(() => undefined);
    }
    expect(await trySignIn(acc.email, acc.password)).toBe("signed in");
  });

  test("INT-004: Forgot password sends the reset email through the authentication service", async () => {
    await signOutLocally();
    await expect(sendPasswordReset(A.verifyAccount2.email)).resolves.toBeUndefined();
    recordActual(MODULE, "INT-004", "Forgot password accepted the registered email address and the authentication service sent the reset email (no error).");
  });

  test("INT-005: A new account must confirm its email; a confirmed account with no child goes to child registration", async () => {
    const email = `ut.int005.${Date.now()}@safetrack-test.com`;
    await signUpGuardian("UT Integration Guardian", email, "Passw0rd!");
    const before = await trySignIn(email, "Passw0rd!");
    expect(before).toMatch(/email not confirmed/i);
    await signInAs(A.guardianNoChild);
    expect(landing()).toBe("Register your child");
    recordActual(MODULE, "INT-005", `Registration created the account and sent a confirmation email; signing in before confirming was refused ("${before}"). A confirmed guardian with no child signed in and was routed to "${landing()}".`);
  });
});

describe("Administrator Dashboard with Authentication", () => {
  test("INT-041: A Guardian account turned off by the administrator cannot sign in until turned on again", async () => {
    await signInAs(A.guardianNoChild);
    const guardianId = state().guardian!.id;
    await signInAs(A.admin);
    const before = (await fetchAdminGuardianAccounts()).find((g: any) => g.id === guardianId) as any;
    await updateAdminGuardianAccountStatus(guardianId, "inactive");
    let off = "";
    try {
      await signInAs(A.guardianNoChild);
      off = state().error ?? (state().session ? "signed in" : "refused");
    } catch (error) {
      off = (error as Error).message;
    }
    await signInAs(A.admin);
    await updateAdminGuardianAccountStatus(guardianId, "active");
    await signInAs(A.guardianNoChild);
    expect(off).toMatch(/turned off/i);
    expect(state().role).toBe("guardian");
    recordActual(MODULE, "INT-041", `The administrator turned the account off (was ${before?.status ?? "active"}); the guardian's sign-in was refused with "${off.replace(/\.$/, "")}". After the administrator turned it on again, the guardian signed in.`);
  });
});

describe("User Settings with Authentication and the dashboard", () => {
  test("INT-044: A deleted account cannot sign in", async () => {
    let message = "";
    try {
      await signInAs(A.deletedAccount);
      message = state().error ?? "signed in";
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/deleted or turned off/i);
    recordActual(MODULE, "INT-044", `Signing in with an account closed through Delete account was refused: "${message}"`);
  });

  test("INT-026: A profile name saved in Profile appears on the Guardian dashboard", async () => {
    await signInAs(A.guardianWithChild);
    const id = state().guardian!.id;
    const original = (await fetchGuardianProfile(id)) as any;
    const name = `${original.full_name ?? original.fullName} Int`;
    try {
      await updateGuardianProfile(id, { fullName: name, email: original.email });
      await signInAs(A.guardianWithChild);
      const shown = (state().guardian as any).fullName ?? (state().guardian as any).full_name;
      expect(shown).toBe(name);
      recordActual(MODULE, "INT-026", `The full name was changed to "${name}" in Profile; after signing in again the dashboard's guardian name read "${shown}". The original name was restored.`);
    } finally {
      await updateGuardianProfile(id, { fullName: original.full_name ?? original.fullName, email: original.email });
    }
  });

  test("INT-045: A guardian sees only their own children's records", async () => {
    await signInAs(A.guardianWithChild);
    const theirChild = state().linkedChildren[0].id;
    await signInAs(A.guardianNoChild);
    const { data: loc } = await supabase.from("location_logs").select("id").eq("child_id", theirChild).limit(5);
    const { data: sos } = await supabase.from("sos_alerts").select("id").eq("child_id", theirChild).limit(5);
    expect(loc ?? []).toHaveLength(0);
    expect(sos ?? []).toHaveLength(0);
    recordActual(MODULE, "INT-045", `Signed in as another guardian, requests for a different family's child returned ${loc?.length ?? 0} location records and ${sos?.length ?? 0} SOS alerts.`);
  });
});
