/**
 * Integration testing: Help & Support -> User Settings (Profile).
 * The real Profile screen's "Help & support" row opens the Help & Support screen, which shows
 * the support information (questions and answers).
 */
import { render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import ProfileScreen from "../../app/(app)/profile";
import HelpSupportScreen from "../../app/(app)/help-support";
import { recordActual } from "../setup/record";
import { signInAs, signOutLocally } from "../setup/session";
import { accounts } from "../setup/accounts";
import { useAuthStore } from "../../store/authStore";
import { MODULE } from "./helpers";

const A = accounts as any;
const user = userEvent.setup();
afterAll(signOutLocally);

describe("Support information from the Profile", () => {
  test("INT-027: Help & support opens from Profile and shows the help information", async () => {
    await signInAs(A.guardianWithChild);
    await render(<ProfileScreen />);
    const row = await waitFor(() => screen.getByText("Help & support"), { timeout: 20000 });
    await user.press(row);
    expect(router.push).toHaveBeenCalledWith("/(app)/help-support");
    await render(<HelpSupportScreen />);
    expect(screen.getByText("How do I link my child's smartwatch?")).toBeTruthy();
    expect(screen.getByText("What happens when my child presses SOS?")).toBeTruthy();
    recordActual(MODULE, "INT-027", 'Pressing "Help & support" on Profile opened /(app)/help-support, which showed the questions such as "How do I link my child\'s smartwatch?" and "What happens when my child presses SOS?".');
  });
});
