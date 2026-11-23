/**
 * Unit testing, Authentication Module: Register Account (CASE-001 to CASE-010).
 * The real Register screen, auth store and Supabase server are used; only
 * navigation is recorded instead of performed.
 */
import { render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import RegisterScreen from "../../app/(auth)/register";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import { accounts } from "../setup/accounts";
import { recordActual } from "../setup/record";

const MODULE = "authentication";
const user = userEvent.setup();

type Form = { name?: string; email?: string; password?: string; confirm?: string };

async function fillAndSubmit(form: Form) {
  await render(<RegisterScreen />);
  if (form.name) await user.type(screen.getByPlaceholderText("Full name"), form.name);
  if (form.email) await user.type(screen.getByPlaceholderText("Email address"), form.email);
  if (form.password) await user.type(screen.getByPlaceholderText("Password"), form.password);
  if (form.confirm) await user.type(screen.getByPlaceholderText("Confirm password"), form.confirm);
  await user.press(screen.getByRole("button", { name: /create account/i }));
}

/** The message shown on the screen (it must be there), as text for the results. */
async function shownText(text: string | RegExp) {
  const node = await waitFor(() => screen.getByText(text), { timeout: 15000 });
  return String(node.props.children);
}

beforeEach(() => {
  useAuthStore.setState({ error: null, isLoading: false });
});


describe("Register Account", () => {









  test("CASE-009: User enters valid registration details", async () => {
    const email = `ut.case009.${Date.now()}@safetrack-test.com`;
    await fillAndSubmit({ name: "UT Case Nine", email, password: "Passw0rd!9", confirm: "Passw0rd!9" });
    await waitFor(() => expect(router.replace).toHaveBeenCalled(), { timeout: 15000 });
    const target = (router.replace as jest.Mock).mock.calls[0][0];
    expect(target).toEqual({ pathname: "/(auth)/login", params: { notice: "registered", email } });

    // The account really exists. Email confirmation is on (2026-11-13), so the
    // server answers "Email not confirmed" for it (an unknown email or a wrong
    // password would answer "Invalid login credentials").
    const { error } = await supabase.auth.signInWithPassword({ email, password: "Passw0rd!9" });
    expect(error?.message).toMatch(/email not confirmed/i);
    recordActual(MODULE, "CASE-009", `New account created with a new test email (the server now waits for its email confirmation); the Login screen opened with the "Account created" notice.`);
    await supabase.auth.signOut({ scope: "local" });
  });
});
