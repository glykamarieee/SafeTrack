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

/**
 * What an email-confirmation link reports, for the Login screen:
 * "email-confirmed" when Supabase confirmed the address, "link-expired" when
 * it refused the link (expired, already used, or replaced by a newer email).
 * Null for any other link. Before 2026-11-13 these links only opened the
 * start screen, so a refused link gave no message at all (CASE-343).
 */
export function confirmationNotice(url: string | null | undefined): "email-confirmed" | "link-expired" | null {
  if (!url || isRecoveryLink(url)) return null;
  if (/[?&#]error(_code|_description)?=/.test(url)) return "link-expired";
  if (/[?&#]type=(signup|email)/.test(url) || (/login/.test(url) && /access_token=|[?&#]code=/.test(url))) return "email-confirmed";
  return null;
}

/** Launch links already sent to Reset password (each is used once). */
const handledLaunchLinks = new Set<string>();

/**
 * The Login notice for the email-confirmation link that started the app, if
 * it hasn't been shown yet.
 */
export async function openedByConfirmationLink(): Promise<"email-confirmed" | "link-expired" | null> {
  if (Platform.OS === "web") return null;
  try {
    const url = await Linking.getInitialURL();
    const notice = confirmationNotice(url);
    if (!url || !notice || handledLaunchLinks.has(url)) return null;
    handledLaunchLinks.add(url);
    return notice;
  } catch {
    return null;
  }
}

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

/** Path and parameter names of a link, never its tokens (for the device log). */
function describe(url: string | null) {
  return url ? `${url.split(/[?#]/)[0]} [${Array.from(url.matchAll(/[?&#]([a-z_]+)=/g), (m) => m[1]).join(",")}]` : "none";
}

if (Platform.OS !== "web") {
  void Linking.getInitialURL()
    .then((url) => {
      console.log(`[SafeTrack link] launch ${describe(url)}`);
      remember(url);
    })
    .catch(() => undefined);
  Linking.addEventListener("url", ({ url }) => {
    console.log(`[SafeTrack link] event ${describe(url)}`);
    remember(url);
    // Already running on another screen: go to Reset password (unless the
    // router already opened it for this link).
    if (isRecoveryLink(url)) {
      setTimeout(() => {
        if (!resetScreenOpen) router.replace("/(auth)/reset-password");
      }, 700);
      return;
    }
    // An email-confirmation link: show the result on Login.
    const notice = confirmationNotice(url);
    if (notice) {
      setTimeout(() => router.replace({ pathname: "/(auth)/login", params: { notice } }), 700);
    }
  });
}

/**
 * The notice for the newest email-confirmation link not shown yet, or null.
 * Used by the Login screen, which these links open directly (expo-router
 * routes safetrack://login to it, so the start screen never sees the link).
 * Each link gives its notice once.
 */
export async function takeConfirmationNotice(): Promise<"email-confirmed" | "link-expired" | null> {
  if (Platform.OS === "web") return null;
  let url = latest;
  if (!url) {
    try {
      url = await Linking.getInitialURL();
    } catch {
      url = null;
    }
  }
  const notice = confirmationNotice(url);
  // Path and parameter names only (never tokens), to check links in the device log.
  if (url) console.log(`[SafeTrack link] ${url.split(/[?#]/)[0]} ${notice ?? "no notice"}; params: ${Array.from(url.matchAll(/[?&#]([a-z_]+)=/g), (m) => m[1]).join(",")}`);
  if (!url || !notice || handledLaunchLinks.has(url)) return null;
  handledLaunchLinks.add(url);
  return notice;
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
