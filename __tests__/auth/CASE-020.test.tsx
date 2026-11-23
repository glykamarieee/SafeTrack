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

  test("CASE-020: Administrator enters an invalid email format", async () => {
    await signIn("admin.safetrack.local", "Passw0rd!");
    const text = await errorShown(/enter the email address/i);
    recordActual(MODULE, "CASE-020", `Blocked: "${text}"`);
  });
});
