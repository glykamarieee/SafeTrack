/**
 * Unit testing, Authentication Module: User Login (CASE-013 to CASE-027).
 * The real Login screen, auth store and Supabase server are used, with real
 * test accounts (a guardian with a child, one without, the administrator and
 * a deleted account). Navigation is recorded instead of performed.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import LoginScreen from "../../app/(auth)/login";
import { supabase } from "../../lib/supabase";
import { markOnboardingSeen } from "../../services/onboardingService";
import { useAuthStore } from "../../store/authStore";
import { accounts } from "../setup/accounts";
import { recordActual } from "../setup/record";

const MODULE = "authentication";
const user = userEvent.setup();

async function signIn(email: string, password: string) {
  await render(<LoginScreen />);
  if (email) await user.type(screen.getByPlaceholderText("Email address"), email);
  if (password) await user.type(screen.getByPlaceholderText("Password"), password);
  await user.press(screen.getByRole("button", { name: /^sign in$/i }));
}

async function errorShown(pattern: RegExp) {
  const node = await waitFor(() => screen.getByText(pattern), { timeout: 15000 });
  return String(node.props.children);
}

async function destination() {
  await waitFor(() => expect(router.replace).toHaveBeenCalled(), { timeout: 20000 });
  return (router.replace as jest.Mock).mock.calls.at(-1)[0];
}

beforeEach(async () => {
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  await AsyncStorage.clear();
  useAuthStore.setState({ session: null, role: null, guardian: null, linkedChildren: [], error: null, isLoading: false });
});

describe("User Login", () => {
  test("CASE-013: Guardian enters an invalid email format", async () => {
    await signIn("guardian.mail.com", "Passw0rd!");
    const text = await errorShown(/enter the email address/i);
    expect(router.replace).not.toHaveBeenCalled();
    recordActual(MODULE, "CASE-013", `Blocked: "${text}"`);
  });

  test("CASE-014: Guardian leaves the email field empty", async () => {
    await signIn("", "Passw0rd!");
    const text = await errorShown(/enter the email address/i);
    recordActual(MODULE, "CASE-014", `Blocked: "${text}"`);
  });

  test("CASE-015: Guardian leaves the password field empty", async () => {
    await signIn(accounts.guardianWithChild.email, "");
    const text = await errorShown(/enter your password/i);
    expect(text).toBe("Enter your password.");
    recordActual(MODULE, "CASE-015", `Blocked: "${text}"`);
  });

  test("CASE-016: Guardian enters valid credentials for the first time on the device", async () => {
    // Nothing saved on this phone yet, so the guardian tour comes first.
    await signIn(accounts.guardianWithChild.email, accounts.guardianWithChild.password);
    const target = await destination();
    expect(target).toEqual({ pathname: "/onboarding", params: { audience: "guardian", next: "/(app)/home" } });
    expect(useAuthStore.getState().role).toBe("guardian");
    recordActual(MODULE, "CASE-016", `Signed in as guardian; the guardian tour opened first (then Home).`);
  });

  test("CASE-017: Guardian with no registered child logs in", async () => {
    await markOnboardingSeen("guardian");
    await signIn(accounts.guardianNoChild.email, accounts.guardianNoChild.password);
    const target = await destination();
    expect(target).toBe("/(auth)/child-registration");
    recordActual(MODULE, "CASE-017", `Signed in (0 children); Register Your Child screen opened.`);
  });

  test("CASE-018: Guardian with a registered child logs in", async () => {
    await markOnboardingSeen("guardian");
    await signIn(accounts.guardianWithChild.email, accounts.guardianWithChild.password);
    const target = await destination();
    expect(target).toBe("/(app)/home");
    const children = useAuthStore.getState().linkedChildren.length;
    expect(children).toBeGreaterThan(0);
    recordActual(MODULE, "CASE-018", `Signed in (${children} children); Guardian Dashboard (Home) opened.`);
  });

  test("CASE-019: Guardian enters a correct email but wrong password", async () => {
    await signIn(accounts.guardianWithChild.email, "WrongPass123");
    const text = await errorShown(/no account matches/i);
    expect(router.replace).not.toHaveBeenCalled();
    recordActual(MODULE, "CASE-019", `Server refused: "${text}"`);
  });

  test("CASE-020: Administrator enters an invalid email format", async () => {
    await signIn("admin.safetrack.local", "Passw0rd!");
    const text = await errorShown(/enter the email address/i);
    recordActual(MODULE, "CASE-020", `Blocked: "${text}"`);
  });

  test("CASE-021: Administrator leaves the email field empty", async () => {
    await signIn("", accounts.admin.password);
    const text = await errorShown(/enter the email address/i);
    recordActual(MODULE, "CASE-021", `Blocked: "${text}"`);
  });

  test("CASE-022: Administrator leaves the password field empty", async () => {
    await signIn(accounts.admin.email, "");
    const text = await errorShown(/enter your password/i);
    recordActual(MODULE, "CASE-022", `Blocked: "${text}"`);
  });

  test("CASE-023: Administrator enters valid credentials", async () => {
    await signIn(accounts.admin.email, accounts.admin.password);
    const target = await destination();
    expect(target).toBe("/(app)/home");
    expect(useAuthStore.getState().role).toBe("admin");
    // Home shows the Admin Dashboard (AdminHome) for the admin role.
    recordActual(MODULE, "CASE-023", `Signed in with role "admin"; Home opened, which shows the Admin Dashboard for administrators.`);
  });

  test("CASE-024: Administrator enters a correct email but wrong password", async () => {
    await signIn(accounts.admin.email, "WrongPass123");
    const text = await errorShown(/no account matches/i);
    recordActual(MODULE, "CASE-024", `Server refused: "${text}"`);
  });

  test("CASE-025: Deactivated or deleted account attempts to log in", async () => {
    await signIn(accounts.deletedAccount.email, accounts.deletedAccount.password);
    const text = await errorShown(/deleted or turned off/i);
    expect(router.replace).not.toHaveBeenCalled();
    recordActual(MODULE, "CASE-025", `Server refused the deleted account: "${text}"`);
  });

  test("CASE-026: User reopens the app with a saved session", async () => {
    await markOnboardingSeen("guardian");
    await useAuthStore.getState().login(accounts.guardianWithChild.email, accounts.guardianWithChild.password);
    // What the phone keeps when the app is closed.
    const saved = await AsyncStorage.multiGet(await AsyncStorage.getAllKeys());
    expect(saved.some(([key]) => key.includes("auth-token"))).toBe(true);

    // Restart: a fresh copy of the app's code, with only the saved storage.
    let href: unknown;
    await jest.isolateModulesAsync(async () => {
      const storageModule = require("@react-native-async-storage/async-storage");
      const Storage = storageModule.default ?? storageModule;
      await Storage.multiSet(saved);
      const testing = require("@testing-library/react-native/pure");
      const React = require("react");
      const Start = require("../../app/index").default;
      const { Redirect } = require("expo-router");
      // Loading Expo again re-installs its fetch stub; keep the real network.
      Object.assign(globalThis, (globalThis as { __nodeNetwork?: object }).__nodeNetwork);
      await testing.render(React.createElement(Start));
      await testing.waitFor(() => expect(Redirect).toHaveBeenCalled(), { timeout: 15000 });
      href = Redirect.mock.calls.at(-1)[0].href;
      await require("../../lib/supabase").supabase.auth.signOut({ scope: "local" });
    });
    expect(href).toBe("/(app)/home");
    recordActual(MODULE, "CASE-026", `After a restart with the saved session, the app opened the Guardian Dashboard (/(app)/home) without logging in.`);
  });

  test("CASE-027: Guardian or Administrator logs out", async () => {
    await useAuthStore.getState().login(accounts.guardianWithChild.email, accounts.guardianWithChild.password);
    const refreshToken = useAuthStore.getState().session?.refresh_token;
    await useAuthStore.getState().logout();

    const { data } = await supabase.auth.getSession();
    expect(data.session).toBeNull();
    expect(useAuthStore.getState().session).toBeNull();
    // The old session is ended on the server too: it cannot be renewed.
    const reuse = await supabase.auth.refreshSession({ refresh_token: refreshToken! });
    expect(reuse.error).not.toBeNull();
    recordActual(MODULE, "CASE-027", `Logged out: no session on the phone, and the server refused to renew the old session ("${reuse.error?.message}").`);
  });
});
