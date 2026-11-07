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
  test("CASE-001: User leaves the Full Name field empty", async () => {
    await fillAndSubmit({ email: "ut.reg@safetrack-test.com", password: "Passw0rd!", confirm: "Passw0rd!" });
    const shown = await shownText("Enter your full name.");
    expect(shown).toBe("Enter your full name.");
    recordActual(MODULE, "CASE-001", `Blocked: "${shown}"`);
  });

  test("CASE-002: User leaves the Email Address field empty", async () => {
    await fillAndSubmit({ name: "UT Guardian", password: "Passw0rd!", confirm: "Passw0rd!" });
    const shown = await shownText("Enter a valid email address.");
    expect(shown).toBe("Enter a valid email address.");
    recordActual(MODULE, "CASE-002", `Blocked: "${shown}"`);
  });

  test("CASE-003: User enters an invalid email format", async () => {
    await fillAndSubmit({ name: "UT Guardian", email: "guardian.mail.com", password: "Passw0rd!", confirm: "Passw0rd!" });
    const shown = await shownText("Enter a valid email address.");
    expect(shown).toBe("Enter a valid email address.");
    recordActual(MODULE, "CASE-003", `"guardian.mail.com" blocked: "${shown}"`);
  });

  test("CASE-004: User leaves the Password field empty", async () => {
    await fillAndSubmit({ name: "UT Guardian", email: "ut.reg@safetrack-test.com" });
    const shown = await shownText("Password must contain at least 8 characters.");
    expect(shown).toBe("Password must contain at least 8 characters.");
    recordActual(MODULE, "CASE-004", `Blocked: "${shown}"`);
  });

  test("CASE-005: User enters a password shorter than 8 characters", async () => {
    await fillAndSubmit({ name: "UT Guardian", email: "ut.reg@safetrack-test.com", password: "Pass12", confirm: "Pass12" });
    const shown = await shownText("Password must contain at least 8 characters.");
    expect(shown).toBe("Password must contain at least 8 characters.");
    recordActual(MODULE, "CASE-005", `6-character password blocked: "${shown}"`);
  });

  test("CASE-006: User leaves the Confirm Password field empty", async () => {
    await fillAndSubmit({ name: "UT Guardian", email: "ut.reg@safetrack-test.com", password: "Passw0rd!" });
    const shown = await shownText("Passwords do not match.");
    expect(shown).toBe("Passwords do not match.");
    recordActual(MODULE, "CASE-006", `Blocked: "${shown}"`);
  });

  test("CASE-007: User enters a mismatched password confirmation", async () => {
    await fillAndSubmit({ name: "UT Guardian", email: "ut.reg@safetrack-test.com", password: "Passw0rd!", confirm: "Passw0rd?" });
    const shown = await shownText("Passwords do not match.");
    expect(shown).toBe("Passwords do not match.");
    recordActual(MODULE, "CASE-007", `Blocked: "${shown}"`);
  });

  test("CASE-008: User registers using an existing email address", async () => {
    // A real, already registered guardian email; the server must refuse it.
    await fillAndSubmit({ name: "UT Guardian", email: accounts.guardianWithChild.email, password: "Passw0rd!", confirm: "Passw0rd!" });
    const shown = await shownText(/already exists/i);
    expect(router.replace).not.toHaveBeenCalled();
    recordActual(MODULE, "CASE-008", `Server refused it: "${shown}"; stayed on Register.`);
  });

  test("CASE-009: User enters valid registration details", async () => {
    const email = `ut.case009.${Date.now()}@safetrack-test.com`;
    await fillAndSubmit({ name: "UT Case Nine", email, password: "Passw0rd!9", confirm: "Passw0rd!9" });
    await waitFor(() => expect(router.replace).toHaveBeenCalled(), { timeout: 15000 });
    const target = (router.replace as jest.Mock).mock.calls[0][0];
    expect(target).toEqual({ pathname: "/(auth)/login", params: { notice: "registered", email } });

    // The account really exists: it can sign in.
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: "Passw0rd!9" });
    expect(error).toBeNull();
    recordActual(MODULE, "CASE-009", `New account created with a new test email; signing in with it worked; the Login screen opened with the "Account created" notice.`);

    // Clean up: the same soft delete the app uses (Delete Account).
    if (data.session) await supabase.rpc("delete_my_account");
    await supabase.auth.signOut({ scope: "local" });
  });

  test("CASE-010: User taps Create Account multiple times", async () => {
    const signUp = jest.spyOn(supabase.auth, "signUp");
    const email = `ut.case010.${Date.now()}@safetrack-test.com`;
    await render(<RegisterScreen />);
    await user.type(screen.getByPlaceholderText("Full name"), "UT Case Ten");
    await user.type(screen.getByPlaceholderText("Email address"), email);
    await user.type(screen.getByPlaceholderText("Password"), "Passw0rd!10");
    await user.type(screen.getByPlaceholderText("Confirm password"), "Passw0rd!10");
    const button = screen.getByRole("button", { name: /create account/i });
    // Three quick taps.
    await user.press(button);
    const busy = screen.getByRole("button", { name: /creating account/i });
    const disabledWhileSaving = Boolean(busy.props.accessibilityState?.disabled);
    await user.press(busy);
    await user.press(busy);
    await waitFor(() => expect(router.replace).toHaveBeenCalled(), { timeout: 15000 });
    expect(disabledWhileSaving).toBe(true);
    expect(signUp).toHaveBeenCalledTimes(1);
    recordActual(MODULE, "CASE-010", `3 taps: button showed "Creating account…" and was disabled; sign-up sent ${signUp.mock.calls.length} time; 1 account created.`);
    signUp.mockRestore();

    const { data } = await supabase.auth.signInWithPassword({ email, password: "Passw0rd!10" });
    if (data.session) await supabase.rpc("delete_my_account");
    await supabase.auth.signOut({ scope: "local" });
  });
});
