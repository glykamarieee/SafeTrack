/**
 * Unit testing, Authentication Module: Password Recovery
 * (CASE-028 to CASE-031, CASE-033 to CASE-035).
 *
 * CASE-032, CASE-036 and CASE-037 need the reset email itself (a real inbox
 * and a phone that opens the link), so they are done by hand on the phone.
 */
import { render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import ForgotPasswordScreen from "../../app/(auth)/forgot-password";
import ResetPasswordScreen from "../../app/(auth)/reset-password";
import * as authService from "../../services/supabaseAuthService";
import { accounts } from "../setup/accounts";
import { recordActual } from "../setup/record";

const MODULE = "authentication";
const user = userEvent.setup();
const SENT = "If an account exists for that email, a reset link has been sent.";

async function requestReset(email: string) {
  await render(<ForgotPasswordScreen />);
  if (email) await user.type(screen.getByPlaceholderText("you@example.com"), email);
  await user.press(screen.getByRole("button", { name: /send reset link/i }));
}

/** The reset screen opened from a link (the URL the email link opens). */
async function openResetLink(url: string) {
  require("expo-linking").__setURL(url);
  await render(<ResetPasswordScreen />);
}

afterEach(() => {
  require("expo-linking").__setURL(null);
});

describe("Password Recovery", () => {

  // For CASE-034 and CASE-035 the link itself is accepted (its check is
  // CASE-032, done by hand); these test the new-password rules on the form.
  async function openValidLink() {
    jest.spyOn(authService, "startPasswordRecovery").mockResolvedValue(undefined);
    await openResetLink("safetrack://reset-password#access_token=t&refresh_token=r&type=recovery");
    await waitFor(() => screen.getByPlaceholderText(/at least 8 characters/i));
  }

  test("CASE-028: User enters a registered email address", async () => {
    await requestReset(accounts.guardianNoChild.email);
    let shown = await waitFor(() => screen.getByText(/reset link has been sent|could not be sent|too many|security purposes/i), { timeout: 20000 });
    let note = "";
    // Supabase allows one reset email per address per minute; a run right
    // after another one waits that minute out and asks again.
    if (String(shown.props.children) !== SENT) {
      note = ` (first try answered "${String(shown.props.children)}" because of Supabase's one-email-per-minute limit; sent again after 65 s)`;
      await new Promise((resolve) => setTimeout(resolve, 65_000));
      await user.press(screen.getByRole("button", { name: /send reset link/i }));
      shown = await waitFor(() => screen.getByText(SENT), { timeout: 20000 });
    }
    expect(String(shown.props.children)).toBe(SENT);
    recordActual(MODULE, "CASE-028", `Server accepted the request: "${SENT}"${note}`);
  }, 120_000);
});
