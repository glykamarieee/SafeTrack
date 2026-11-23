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
