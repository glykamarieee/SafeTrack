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
