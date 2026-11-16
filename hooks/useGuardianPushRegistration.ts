import { useEffect } from "react";
import { AppState } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useAuthStore } from "../store/authStore";
import { selectChild } from "./useSelectedChild";
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

    void listenForNotificationTaps(async (route, childId) => {
      // Open the notification's own child; reload the list first when that child is new
      // (registered from another device since this session started).
      if (childId) {
        const auth = useAuthStore.getState();
        if (!auth.linkedChildren.some((child) => child.id === childId)) {
          await auth.refreshLinkedChildren();
        }
        if (useAuthStore.getState().linkedChildren.some((child) => child.id === childId)) {
          selectChild(childId);
        }
      }
      router.navigate(route as Href);
    }).then((cleanup) => {
      if (cancelled) cleanup();
      else stop = cleanup;
    });

    return () => {
      cancelled = true;
      stop?.();
    };
  }, [enabled, router]);

  // Children added or removed on another device appear when the app comes back to the front.
  useEffect(() => {
    if (!enabled) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void useAuthStore.getState().refreshLinkedChildren();
    });
    return () => subscription.remove();
  }, [enabled]);

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