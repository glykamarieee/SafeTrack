import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { router } from "expo-router";

/**
 * Remembers the links that open SafeTrack (password reset, email
 * confirmation) from the moment the app starts.
 *
 * A screen that listens itself misses a link that arrives before it mounts:
 * when SafeTrack is already open and the guardian taps the reset link in
 * Gmail, the link event fires, expo-router then opens Reset password, and
 * that screen's own listener only starts afterwards, so it never saw the link
 * ("This reset link can't be used"). Imported by app/_layout.tsx.
 *
 * A reset link that starts SafeTrack from closed was routed to the start
 * screen, which then showed Get started (2026-11-08): the start screen now
 * asks `openedByNewResetLink` and opens Reset password for a recovery link,
 * and a recovery link that arrives while another screen is open moves there.
 */
let latest: string | null = null;
const listeners = new Set<(url: string) => void>();

/** True while the Reset password screen is open (it handles links itself). */
let resetScreenOpen = false;
export function setResetScreenOpen(open: boolean) {
  resetScreenOpen = open;
}

/** A password-reset link: Supabase's recovery token, or our reset path. */
export function isRecoveryLink(url: string | null | undefined): boolean {
  return Boolean(url && (/[?&#]type=recovery\b/.test(url) || /reset-password/.test(url)));
}

function remember(url: string | null) {
  if (!url) return;
  latest = url;
  listeners.forEach((listener) => listener(url));
}

/** Launch links already sent to Reset password (each is used once). */
const handledLaunchLinks = new Set<string>();

/**
 * Whether the screen was just opened by a password-reset link that hasn't
 * been handled yet. Asked fresh each time the start screen mounts: Android
 * can open a new SafeTrack screen for a link while the app is still running,
 * and that screen has its own launch link.
 */
export async function openedByNewResetLink(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const url = await Linking.getInitialURL();
    if (!url || !isRecoveryLink(url) || handledLaunchLinks.has(url)) return false;
    handledLaunchLinks.add(url);
    remember(url);
    return true;
  } catch {
    return false;
  }
}

if (Platform.OS !== "web") {
  void Linking.getInitialURL().then(remember).catch(() => undefined);
  Linking.addEventListener("url", ({ url }) => {
    remember(url);
    // Already running on another screen: go to Reset password (unless the
    // router already opened it for this link).
    if (isRecoveryLink(url)) {
      setTimeout(() => {
        if (!resetScreenOpen) router.replace("/(auth)/reset-password");
      }, 700);
    }
  });
}

/** The newest link that carries a recovery token, code or error, if any. */
export function latestAuthLink(): string | null {
  return latest && /access_token=|[?&#]code=|error(_description)?=/.test(latest) ? latest : null;
}

/** Calls `listener` for each link that opens SafeTrack from now on. */
export function onAppLink(listener: (url: string) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
