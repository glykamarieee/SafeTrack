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

describe("User Settings with Authentication and the dashboard", () => {

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
