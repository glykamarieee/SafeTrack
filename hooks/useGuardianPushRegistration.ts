import { useEffect } from "react";
import { useRouter, type Href } from "expo-router";
import {
  configureSafeTrackNotificationHandler,
  listenForNotificationTaps,
  registerGuardianPushToken,
} from "../services/pushRegistrationService";

/**
 * Registers Guardian push notifications once an authenticated
 * Guardian enters the SafeTrack application.
 *
 * Push registration is intentionally failure-tolerant:
 * SafeTrack location monitoring and dashboard access must continue
 * even if push notification registration is temporarily unavailable.
 */
export function useGuardianPushRegistration(
  enabled = true
): void {
  const router = useRouter();

  // Tapping an SOS or safety notification opens the matching screen.
  useEffect(() => {
    if (!enabled) return;

    let stop: (() => void) | null = null;
    let cancelled = false;

    void listenForNotificationTaps((route) => router.navigate(route as Href)).then((cleanup) => {
      if (cancelled) cleanup();
      else stop = cleanup;
    });

    return () => {
      cancelled = true;
      stop?.();
    };
  }, [enabled, router]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    async function initializeGuardianPushNotifications() {
      try {
        await configureSafeTrackNotificationHandler();

        if (cancelled) {
          return;
        }

        await registerGuardianPushToken();
      } catch (error: unknown) {
        if (cancelled) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : String(error);

        console.warn(
          "[SafeTrack push registration]",
          message
        );
      }
    }

    void initializeGuardianPushNotifications();

    return () => {
      cancelled = true;
    };
  }, [enabled]);
}