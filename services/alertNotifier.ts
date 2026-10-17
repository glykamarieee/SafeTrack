import { AppState, Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";

/**
 * Phone notifications for SafeTrack alerts while the app is running, including
 * when the guardian has switched to another app. They come from the live
 * (realtime) updates the app already receives.
 *
 * When SafeTrack is fully closed, only server push notifications can arrive
 * (send_guardian_push in the database). Both use the same channels, so they
 * sound the same; when this phone also gets the server push for an alert, the
 * local copy is skipped (see notifyAlert).
 */

/** Android channels. Ids are fixed: send_guardian_push() uses them too. */
export const ALERT_CHANNELS = {
  sos: "safetrack-sos",
  zones: "safetrack-zones",
  general: "safetrack-alerts",
} as const;

export type AlertKind = keyof typeof ALERT_CHANNELS;

function notificationsAvailable() {
  return Platform.OS !== "web" && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

async function load() {
  return notificationsAvailable() ? await import("expo-notifications") : null;
}

let channelsReady: Promise<void> | null = null;

/**
 * Creates the alert channels with their sounds (files in res/raw, added by the
 * expo-notifications config plugin). Android fixes a channel's sound when it is
 * first created, so a new sound needs a new channel id.
 */
export function ensureAlertChannels(): Promise<void> {
  if (Platform.OS !== "android") return Promise.resolve();

  channelsReady ??= (async () => {
    const Notifications = await load();
    if (!Notifications) return;

    await Notifications.setNotificationChannelAsync(ALERT_CHANNELS.sos, {
      name: "SOS emergencies",
      description: "A child pressed SOS. Plays a siren.",
      importance: Notifications.AndroidImportance.MAX,
      sound: "sos_alarm.wav",
      vibrationPattern: [0, 600, 250, 600, 250, 600],
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      audioAttributes: { usage: Notifications.AndroidAudioUsage.ALARM },
    });

    await Notifications.setNotificationChannelAsync(ALERT_CHANNELS.zones, {
      name: "Safe zones",
      description: "A child arrived at or left a safe zone.",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "zone_chime.wav",
      vibrationPattern: [0, 200, 120, 200],
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

    await Notifications.setNotificationChannelAsync(ALERT_CHANNELS.general, {
      name: "SafeTrack Safety Alerts",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 180, 250],
      sound: "default",
    });
  })().catch((error) => {
    channelsReady = null;
    console.warn("[SafeTrack notifications] channels:", error);
  });

  return channelsReady;
}

export function channelForType(type: string): string {
  if (type === "sos" || type === "sos_realert") return ALERT_CHANNELS.sos;
  if (type === "entry" || type === "exit") return ALERT_CHANNELS.zones;
  return ALERT_CHANNELS.general;
}

// Alerts already shown on this phone (local or server push), so each shows once.
const shown = new Map<string, number>();
const SHOWN_TTL_MS = 10 * 60_000;

function remember(key: string) {
  const now = Date.now();
  for (const [k, at] of shown) if (now - at > SHOWN_TTL_MS) shown.delete(k);
  shown.set(key, now);
}

/** True when a server push for this alert type arrived in the last 90 s. */
const recentPushes: { type: string; at: number }[] = [];

/** Called for every server push this phone receives while SafeTrack runs. */
export function noteServerPush(type: string) {
  recentPushes.push({ type, at: Date.now() });
  while (recentPushes.length > 20) recentPushes.shift();
}

function pushArrivedRecently(type: string) {
  const since = Date.now() - 90_000;
  return recentPushes.some((push) => push.type === type && push.at >= since);
}

let serverPushRegistered = false;
export function setServerPushRegistered(value: boolean) {
  serverPushRegistered = value;
}

/** True when the tray already holds a server push of this type from the last 90 s. */
async function trayHasServerPush(type: string) {
  const Notifications = await load();
  if (!Notifications) return false;
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    const since = Date.now() - 90_000;
    return presented.some((item) => {
      const data = item.request.content.data as Record<string, unknown> | undefined;
      return data?.type === type && data?.local !== true && item.date >= since;
    });
  } catch {
    return false;
  }
}

export type AlertNotice = {
  /** Unique per alert (e.g. `sos:<id>`); the same key never shows twice. */
  key: string;
  /** Same values as the server push `data.type`: sos, sos_realert, entry, exit, … */
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

/**
 * Shows an alert as a phone notification with its channel's sound, in the
 * foreground and in the background. Never throws.
 */
export async function notifyAlert(notice: AlertNotice): Promise<void> {
  if (shown.has(notice.key)) return;
  remember(notice.key);

  try {
    const Notifications = await load();
    if (!Notifications) return;
    await ensureAlertChannels();

    // A phone registered for server pushes may get the same alert from the
    // server a moment later; give it a few seconds and skip the local copy if
    // it came. (In the background the JS timers can be paused, so this only
    // waits while the app is open.)
    if (serverPushRegistered && AppState.currentState === "active") {
      await new Promise((resolve) => setTimeout(resolve, 4000));
    }
    if (pushArrivedRecently(notice.type) || (await trayHasServerPush(notice.type))) return;

    await Notifications.scheduleNotificationAsync({
      identifier: notice.key,
      content: {
        title: notice.title,
        body: notice.body,
        data: { ...notice.data, type: notice.type, local: true },
        sound: true,
        priority: notice.type === "sos" || notice.type === "sos_realert" ? "max" : "high",
      },
      trigger: Platform.OS === "android" ? { channelId: channelForType(notice.type) } : null,
    });
  } catch (error) {
    console.warn("[SafeTrack notifications] could not show alert:", error);
  }
}

/**
 * Shows a sample SOS or safe-zone notification after `seconds`, so the
 * guardian can switch to another app and hear how alerts arrive. The delay is
 * a native timer, so it fires in the background too.
 */
export async function scheduleTestAlert(kind: "sos" | "zones", seconds = 5): Promise<boolean> {
  const Notifications = await load();
  if (!Notifications) return false;
  await ensureAlertChannels();

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") return false;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: kind === "sos" ? "🚨 Test: SOS alert" : "Test: safe-zone alert",
      body: kind === "sos" ? "This is how an SOS will sound. No one needs help." : "This is how arriving at or leaving a safe zone will sound.",
      data: { type: "test", local: true },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      channelId: ALERT_CHANNELS[kind],
    },
  });
  return true;
}
