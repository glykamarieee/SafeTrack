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
 * waits for `initialLink` and opens Reset password for a recovery link, and a
 * recovery link that arrives while another screen is open moves there too.
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

/** The link that started the app (null when opened normally); resolves once. */
export const initialLink: Promise<string | null> =
  Platform.OS === "web"
    ? Promise.resolve(null)
    : Linking.getInitialURL()
        .then((url) => {
          remember(url);
          return url;
        })
        .catch(() => null);

if (Platform.OS !== "web") {
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
