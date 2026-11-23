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
});
