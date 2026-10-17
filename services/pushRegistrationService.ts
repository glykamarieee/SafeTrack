import { Platform } from "react-native";
import * as Device from "expo-device";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { supabase } from "../lib/supabase";
import { ensureAlertChannels, noteServerPush, setServerPushRegistered } from "./alertNotifier";

// The token this device registered, so it can be switched off on logout.
let registeredToken: string | null = null;

/** Why this phone can or can't get notifications while SafeTrack is closed. */
export type PushStatus = "registered" | "no-permission" | "unavailable" | "failed" | "unknown";
let pushStatus: { status: PushStatus; detail?: string } = { status: "unknown" };
const pushStatusListeners = new Set<() => void>();

function setPushStatus(status: PushStatus, detail?: string) {
  pushStatus = { status, detail };
  setServerPushRegistered(status === "registered");
  pushStatusListeners.forEach((listener) => listener());
}

export function getPushStatus() {
  return pushStatus;
}

export function subscribePushStatus(listener: () => void) {
  pushStatusListeners.add(listener);
  return () => {
    pushStatusListeners.delete(listener);
  };
}

/**
 * Expo Go no longer supports Android remote push notifications
 * through expo-notifications.
 *
 * SafeTrack therefore skips remote push registration while running
 * inside Expo Go, but enables it normally in a development build
 * or installed SafeTrack APK.
 */
function isRunningInExpoGo(): boolean {
  // `appOwnership` is deprecated; executionEnvironment is the supported check.
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

/**
 * Load expo-notifications only when SafeTrack is running as its own
 * development/native build.
 *
 * IMPORTANT:
 * We intentionally do NOT import expo-notifications at the top of
 * this file because doing so causes Expo Go to throw during startup.
 */
async function loadNotifications() {
  // Push notifications only exist on phones: on the web build the module's
  // native methods (getLastNotificationResponse, push tokens) throw.
  if (isRunningInExpoGo() || Platform.OS === "web") {
    return null;
  }

  return await import("expo-notifications");
}

/**
 * Configure how foreground SafeTrack notifications are displayed.
 *
 * In Expo Go this safely does nothing.
 */
export async function configureSafeTrackNotificationHandler(): Promise<void> {
  const Notifications = await loadNotifications();

  if (!Notifications) {
    console.info(
      "[SafeTrack] Push notification handler skipped in Expo Go."
    );
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      // A server push while SafeTrack is open: remember it, so the same alert
      // from the live updates is not shown twice.
      const data = notification.request.content.data as Record<string, unknown> | undefined;
      if (data?.local !== true && typeof data?.type === "string") noteServerPush(data.type);

      return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      };
    },
  });
}

/**
 * Register the Guardian device for SafeTrack push notifications.
 *
 * Returns:
 * - Expo push token when registration succeeds
 * - null when push registration is unavailable or not permitted
 */
export async function registerGuardianPushToken(): Promise<string | null> {
  // Expo Go cannot register Android remote push notifications.
  if (isRunningInExpoGo()) {
    console.info(
      "[SafeTrack] Remote push registration skipped in Expo Go. " +
        "Use the SafeTrack development build/APK to test notifications."
    );

    setPushStatus("unavailable", "Expo Go");
    return null;
  }

  // Push notification tokens must be generated on a real device.
  if (!Device.isDevice) {
    console.info(
      "[SafeTrack] Push registration skipped because this is not a physical device."
    );

    setPushStatus("unavailable", "emulator");
    return null;
  }

  const Notifications = await loadNotifications();

  if (!Notifications) {
    return null;
  }

  // Android channels (SOS siren, safe-zone chime, other alerts).
  await ensureAlertChannels();

  /**
   * Request notification permission if it has not already been granted.
   */
  const currentPermission =
    await Notifications.getPermissionsAsync();

  let permissionStatus = currentPermission.status;

  if (permissionStatus !== "granted") {
    const requestedPermission =
      await Notifications.requestPermissionsAsync();

    permissionStatus = requestedPermission.status;
  }

  if (permissionStatus !== "granted") {
    console.info(
      "[SafeTrack] Guardian did not grant notification permission."
    );

    setPushStatus("no-permission");
    return null;
  }

  /**
   * Expo project ID is required when requesting an Expo push token.
   */
  const projectId =
    Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra?.eas?.projectId as
      | string
      | undefined);

  if (!projectId) {
    console.warn(
      "[SafeTrack] Expo EAS projectId is missing. " +
        "Push registration will be available after the SafeTrack " +
        "EAS project configuration is completed."
    );

    setPushStatus("unavailable", "no EAS project");
    return null;
  }

  /**
   * Generate the Guardian device's Expo push token.
   */
  let expoPushToken: { data: string };
  try {
    expoPushToken = await Notifications.getExpoPushTokenAsync({ projectId });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    setPushStatus("failed", detail);
    throw error;
  }

  const pushToken = expoPushToken.data;

  if (!pushToken) {
    throw new Error(
      "SafeTrack could not generate a Guardian push token."
    );
  }

  /**
   * Store/update the token for the signed-in Guardian.
   */
  const { error } = await supabase.rpc(
    "register_my_push_token",
    {
      p_push_token: pushToken,
      p_platform: Platform.OS,
      p_device_name: Device.modelName ?? null,
    }
  );

  if (error) {
    setPushStatus("failed", error.message);
    throw new Error(
      error.message ||
        "SafeTrack could not register this device for notifications."
    );
  }

  registeredToken = pushToken;
  setPushStatus("registered");

  return pushToken;
}

/**
 * Stop pushes to this device for the guardian who is logging out. Must run
 * before signing out (the row is updated as that guardian). Never throws:
 * logout must work offline.
 */
export async function unregisterGuardianPushToken(): Promise<void> {
  if (!registeredToken) return;

  const token = registeredToken;
  registeredToken = null;
  setPushStatus("unknown");

  const { error } = await supabase
    .from("guardian_push_tokens")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("push_token", token);

  if (error) {
    console.warn("[SafeTrack] Could not switch off this device's push token:", error.message);
  }
}

/** Where a tapped notification should open, from the push's `data.type`. */
export function routeForNotification(data: Record<string, unknown> | undefined): string | null {
  const type = typeof data?.type === "string" ? data.type : "";

  if (type === "sos" || type === "sos_realert") return "/(app)/sos-alerts";
  if (["entry", "exit", "possible_anomaly", "watch_disconnected", "prolonged_inactivity"].includes(type)) {
    return "/(app)/history";
  }

  return null;
}

/**
 * Opens the right screen when the guardian taps a notification, including the
 * one that launched the app. Returns a cleanup function.
 */
export async function listenForNotificationTaps(open: (route: string) => void): Promise<() => void> {
  const Notifications = await loadNotifications();

  if (!Notifications) return () => undefined;

  const handle = (response: { notification: { request: { content: { data?: Record<string, unknown> } } } } | null) => {
    const route = routeForNotification(response?.notification.request.content.data);
    if (route) open(route);
  };

  handle(await Notifications.getLastNotificationResponseAsync());

  const subscription = Notifications.addNotificationResponseReceivedListener(handle);

  return () => subscription.remove();
}