import { Platform } from "react-native";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { supabase } from "../lib/supabase";

/**
 * Expo Go no longer supports Android remote push notifications
 * through expo-notifications.
 *
 * SafeTrack therefore skips remote push registration while running
 * inside Expo Go, but enables it normally in a development build
 * or installed SafeTrack APK.
 */
function isRunningInExpoGo(): boolean {
  return Constants.appOwnership === "expo";
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
  if (isRunningInExpoGo()) {
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
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
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

    return null;
  }

  // Push notification tokens must be generated on a real device.
  if (!Device.isDevice) {
    console.info(
      "[SafeTrack] Push registration skipped because this is not a physical device."
    );

    return null;
  }

  const Notifications = await loadNotifications();

  if (!Notifications) {
    return null;
  }

  /**
   * Android notification channel.
   */
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("safetrack-alerts", {
      name: "SafeTrack Safety Alerts",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 180, 250],
      sound: "default",
    });
  }

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

    return null;
  }

  /**
   * Generate the Guardian device's Expo push token.
   */
  const expoPushToken =
    await Notifications.getExpoPushTokenAsync({
      projectId,
    });

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
    throw new Error(
      error.message ||
        "SafeTrack could not register this device for notifications."
    );
  }

  return pushToken;
}