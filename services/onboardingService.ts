import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Who the tour is for: `welcome` is for anyone opening the app for the first
 * time, before signing in. The watch has its own tour on the watch.
 */
export type OnboardingAudience = "welcome" | "guardian" | "child";

const KEY = (audience: OnboardingAudience) => `safetrack.onboarding.${audience}`;

// Remembered for this app session too, so a storage failure shows the tour
// at most once instead of on every login.
const seenThisSession = new Set<OnboardingAudience>();

/** True once this device has finished or skipped the tour for `audience`. */
export async function hasSeenOnboarding(audience: OnboardingAudience): Promise<boolean> {
  if (seenThisSession.has(audience)) return true;
  try {
    return (await AsyncStorage.getItem(KEY(audience))) === "done";
  } catch {
    return false;
  }
}

/** A device that has already seen any tour isn't new, so it skips the welcome. */
export async function needsWelcomeGuide(): Promise<boolean> {
  const seen = await Promise.all((["welcome", "guardian", "child"] as const).map(hasSeenOnboarding));
  return !seen.some(Boolean);
}

export async function markOnboardingSeen(audience: OnboardingAudience): Promise<void> {
  seenThisSession.add(audience);
  try {
    await AsyncStorage.setItem(KEY(audience), "done");
  } catch {
    // Not fatal: the in-memory flag stops it repeating this session.
  }
}
