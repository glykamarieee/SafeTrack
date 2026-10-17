import { Platform } from "react-native";
import * as Linking from "expo-linking";

/**
 * Remembers the links that open SafeTrack (password reset, email
 * confirmation) from the moment the app starts.
 *
 * A screen that listens itself misses a link that arrives before it mounts:
 * when SafeTrack is already open and the guardian taps the reset link in
 * Gmail, the link event fires, expo-router then opens Reset password, and
 * that screen's own listener only starts afterwards, so it never saw the link
 * ("This reset link can't be used"). Imported by app/_layout.tsx.
 */
let latest: string | null = null;
const listeners = new Set<(url: string) => void>();

function remember(url: string | null) {
  if (!url) return;
  latest = url;
  listeners.forEach((listener) => listener(url));
}

if (Platform.OS !== "web") {
  void Linking.getInitialURL().then(remember).catch(() => undefined);
  Linking.addEventListener("url", ({ url }) => remember(url));
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
