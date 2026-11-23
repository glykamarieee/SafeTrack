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


  test("CASE-033: User opens an expired or used reset link", async () => {
    // Exactly what Supabase sends the app to when the link has expired.
    await openResetLink(
      "safetrack://reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    );
    const message = await waitFor(() => screen.getByText(/expired or was already used/i));
    await user.press(screen.getByRole("button", { name: /request a new reset link/i }));
    expect(router.replace).toHaveBeenCalledWith("/(auth)/forgot-password");
    recordActual(MODULE, "CASE-033", `"${String(message.props.children)}" shown; "Request a new reset link" opened the reset request screen.`);
  });
});
