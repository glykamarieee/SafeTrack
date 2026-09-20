import { useEffect } from "react";
import {
  configureSafeTrackNotificationHandler,
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