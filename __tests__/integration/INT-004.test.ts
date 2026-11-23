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

  test("INT-004: Forgot password sends the reset email through the authentication service", async () => {
    await signOutLocally();
    await expect(sendPasswordReset(A.verifyAccount2.email)).resolves.toBeUndefined();
    recordActual(MODULE, "INT-004", "Forgot password accepted the registered email address and the authentication service sent the reset email (no error).");
  });
});
