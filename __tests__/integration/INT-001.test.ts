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
});
