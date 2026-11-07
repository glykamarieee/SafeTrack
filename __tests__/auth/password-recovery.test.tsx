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

  test("CASE-029: User enters an email that is not registered", async () => {
    await requestReset(`nobody.${Date.now()}@safetrack-test.com`);
    const shown = await waitFor(() => screen.getByText(/reset link has been sent|could not be sent|too many/i), { timeout: 20000 });
    // Exactly the same answer as for a registered email.
    expect(String(shown.props.children)).toBe(SENT);
    recordActual(MODULE, "CASE-029", `Same message as a registered email: "${SENT}" (does not reveal which emails exist).`);
  });

  test("CASE-030: User leaves the email field empty", async () => {
    const send = jest.spyOn(authService, "sendPasswordReset");
    await requestReset("");
    expect(screen.getByText("Enter a valid email address.")).toBeOnTheScreen();
    expect(send).not.toHaveBeenCalled();
    send.mockRestore();
    recordActual(MODULE, "CASE-030", `Blocked before sending: "Enter a valid email address."`);
  });

  test("CASE-031: User enters an invalid email format", async () => {
    const send = jest.spyOn(authService, "sendPasswordReset");
    await requestReset("guardian@mail");
    expect(screen.getByText("Enter a valid email address.")).toBeOnTheScreen();
    expect(send).not.toHaveBeenCalled();
    send.mockRestore();
    recordActual(MODULE, "CASE-031", `"guardian@mail" blocked before sending: "Enter a valid email address."`);
  });

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

  // For CASE-034 and CASE-035 the link itself is accepted (its check is
  // CASE-032, done by hand); these test the new-password rules on the form.
  async function openValidLink() {
    jest.spyOn(authService, "startPasswordRecovery").mockResolvedValue(undefined);
    await openResetLink("safetrack://reset-password#access_token=t&refresh_token=r&type=recovery");
    await waitFor(() => screen.getByPlaceholderText(/at least 8 characters/i));
  }

  test("CASE-034: User enters a new password shorter than 8 characters", async () => {
    await openValidLink();
    const update = jest.spyOn(authService, "updateMyPassword");
    await user.type(screen.getByPlaceholderText(/at least 8 characters/i), "Abc123");
    await user.type(screen.getAllByLabelText(/confirm new password/i)[0]!, "Abc123");
    await user.press(screen.getByRole("button", { name: /save new password/i }));
    const text = String(screen.getByText(/at least 8 characters\./i).props.children);
    expect(update).not.toHaveBeenCalled();
    jest.restoreAllMocks();
    recordActual(MODULE, "CASE-034", `6 characters rejected, nothing saved: "${text}"`);
  });

  test("CASE-035: User enters a mismatched confirmation password", async () => {
    await openValidLink();
    const update = jest.spyOn(authService, "updateMyPassword");
    await user.type(screen.getByPlaceholderText(/at least 8 characters/i), "NewPassw0rd!");
    await user.type(screen.getAllByLabelText(/confirm new password/i)[0]!, "NewPassw0rd?");
    await user.press(screen.getByRole("button", { name: /save new password/i }));
    const text = String(screen.getByText(/do not match/i).props.children);
    expect(update).not.toHaveBeenCalled();
    jest.restoreAllMocks();
    recordActual(MODULE, "CASE-035", `Rejected, nothing saved: "${text}"`);
  });
});
