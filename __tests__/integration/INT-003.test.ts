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
});
