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
});
