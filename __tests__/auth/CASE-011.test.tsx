/**
 * Unit testing, Authentication Module: Welcome Guide (CASE-011, CASE-012).
 * The real start screen (app/index.tsx) decides where a new install goes.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { Redirect, router } from "expo-router";

import StartScreen from "../../app/index";
import OnboardingScreen from "../../app/onboarding";
import { needsWelcomeGuide } from "../../services/onboardingService";
import { recordActual } from "../setup/record";

const MODULE = "authentication";
const user = userEvent.setup();

/** Where the start screen sent the user (after its 1.8 s splash). */
async function startDestination() {
  await render(<StartScreen />);
  await waitFor(() => expect(Redirect).toHaveBeenCalled(), { timeout: 8000 });
  return (Redirect as unknown as jest.Mock).mock.calls.at(-1)[0].href;
}

describe("Welcome Guide", () => {

  test("CASE-011: New user opens the installed app for the first time", async () => {
    await AsyncStorage.clear(); // a fresh install: nothing saved on the phone
    const href = await startDestination();
    expect(href).toEqual({ pathname: "/onboarding", params: { audience: "welcome" } });
    recordActual(MODULE, "CASE-011", `Fresh install opened the welcome guide (/onboarding, audience "welcome") before the Welcome screen.`);
  });
});
