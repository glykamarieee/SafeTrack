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









  test("CASE-005: User enters a password shorter than 8 characters", async () => {
    await fillAndSubmit({ name: "UT Guardian", email: "ut.reg@safetrack-test.com", password: "Pass12", confirm: "Pass12" });
    const shown = await shownText("Password must contain at least 8 characters.");
    expect(shown).toBe("Password must contain at least 8 characters.");
    recordActual(MODULE, "CASE-005", `6-character password blocked: "${shown}"`);
  });
});
