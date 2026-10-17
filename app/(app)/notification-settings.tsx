import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { Text } from "../../components/ui/NativeText";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import {
  AccountMessage,
  AccountScreenFrame,
  accountStyles,
} from "../../components/profile/AccountScreenFrame";
import { useAuthStore } from "../../store/authStore";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  fetchNotificationPreferences,
  saveNotificationPreferences,
  type NotificationPreferences,
} from "../../services/accountService";
import { guardianColors as colors } from "../../constants/guardianDesign";
import { loadSoundSetting, playSound, setSoundsEnabled, type SoundName } from "../../lib/sounds";
import { scheduleTestAlert } from "../../services/alertNotifier";
import { getPushStatus, subscribePushStatus, type PushStatus } from "../../services/pushRegistrationService";

import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { guardianPalette } from "../../theme/legacy";

const PUSH_STATUS_TEXT: Record<PushStatus, string> = {
  registered: "Ready: alerts reach this phone even when SafeTrack is closed.",
  "no-permission": "Notifications are off for SafeTrack. Turn them on in the phone's Settings → Apps → SafeTrack → Notifications.",
  unavailable: "This phone can only get alerts while SafeTrack is open or in the background.",
  failed: "Couldn't register this phone for alerts while SafeTrack is closed. Alerts still arrive while it's open or in the background.",
  unknown: "Checking…",
};

const PREVIEWS: { sound: SoundName; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { sound: "alarm", label: "SOS siren", icon: "warning-outline" },
  { sound: "chime", label: "Safe-zone chime", icon: "shield-checkmark-outline" },
  { sound: "success", label: "Done", icon: "checkmark-circle-outline" },
];

const OPTIONS: { key: keyof NotificationPreferences; icon: keyof typeof Ionicons.glyphMap; title: string; text: string }[] = [
  { key: "safeZone", icon: "shield-checkmark-outline", title: "Safe Zone entry and exit", text: "When your child enters or leaves a Safe Zone." },
  { key: "anomaly", icon: "analytics-outline", title: "AI unusual-movement notices", text: "Advisory notices about unusual movement." },
  { key: "device", icon: "watch-outline", title: "Device and inactivity", text: "Watch disconnected or no movement for a long time." },
];

/** Which non-emergency push notifications this guardian receives. SOS is always on. */
export default function NotificationSettingsScreen() {
  const styles = useStyles();
  const colors = guardianPalette(useTheme().colors);

  const guardianId = useAuthStore((state) => state.guardian?.id);
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<keyof NotificationPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!guardianId) return;
      let active = true;
      setLoading(true);
      fetchNotificationPreferences(guardianId)
        .then((value) => active && setPrefs(value))
        .catch((reason: Error) => active && setError(reason.message))
        .finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, [guardianId]),
  );

  const [soundsOn, setSoundsOn] = useState(true);
  const [testNote, setTestNote] = useState<string | null>(null);
  const push = useSyncExternalStore(subscribePushStatus, getPushStatus);

  useEffect(() => {
    void loadSoundSetting().then(setSoundsOn);
  }, []);

  const toggleSounds = (value: boolean) => {
    setSoundsOn(value);
    void setSoundsEnabled(value).then(() => value && playSound("success"));
  };

  const sendTest = async () => {
    setTestNote(null);
    const ok = await scheduleTestAlert("sos", 5).catch(() => false);
    setTestNote(
      ok
        ? "A test SOS notification arrives in 5 seconds. Go to another app or lock the phone to see and hear it."
        : "Notifications are off for SafeTrack. Turn them on in the phone's Settings first.",
    );
  };

  const toggle = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!guardianId) return;
    const previous = prefs;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setSaving(key);
    setError(null);
    try {
      await saveNotificationPreferences(guardianId, next);
    } catch (reason) {
      setPrefs(previous);
      setError(reason instanceof Error ? reason.message : "Could not save notification settings.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <AccountScreenFrame title="Notifications" subtitle="Choose which alerts reach this account." backTo="/(app)/profile">
      <AccountMessage text={error} tone="error" />

      <View style={[styles.row, styles.locked]}>
        <Ionicons name="warning-outline" size={20} color={colors.danger} />
        <View style={styles.copy}>
          <Text style={styles.title}>SOS alerts and re-alerts</Text>
          <Text style={styles.text}>Always on. Emergency alerts cannot be turned off.</Text>
        </View>
        <Switch value disabled trackColor={{ true: colors.dangerSoft, false: colors.borderStrong }} thumbColor={colors.danger} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : (
        OPTIONS.map((option) => (
          <View key={option.key} style={styles.row}>
            <Ionicons name={option.icon} size={20} color={colors.primaryDark} />
            <View style={styles.copy}>
              <Text style={styles.title}>{option.title}</Text>
              <Text style={styles.text}>{option.text}</Text>
            </View>
            <Switch
              accessibilityLabel={option.title}
              value={prefs[option.key]}
              disabled={saving !== null}
              onValueChange={(value) => void toggle(option.key, value)}
              trackColor={{ true: colors.primary, false: colors.borderStrong }}
              thumbColor="#FFFFFF"
            />
          </View>
        ))
      )}

      <Text style={[accountStyles.note, styles.footer]}>
        Settings apply to every phone signed in to this account. Events still appear in Notifications and Activity History.
      </Text>

      <Text style={styles.section}>SOUNDS</Text>
      <View style={styles.row}>
        <Ionicons name="volume-high-outline" size={20} color={colors.primaryDark} />
        <View style={styles.copy}>
          <Text style={styles.title}>Sound effects in the app</Text>
          <Text style={styles.text}>Sounds for SOS, saving and other actions. Alert notifications keep their own sounds.</Text>
        </View>
        <Switch
          accessibilityLabel="Sound effects in the app"
          value={soundsOn}
          onValueChange={toggleSounds}
          trackColor={{ true: colors.primary, false: colors.borderStrong }}
          thumbColor="#FFFFFF"
        />
      </View>

      <View style={styles.previews}>
        {PREVIEWS.map((item) => (
          <Pressable
            key={item.sound}
            accessibilityRole="button"
            accessibilityLabel={`Play ${item.label}`}
            onPress={() => playSound(item.sound)}
            style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
          >
            <Ionicons name={item.icon} size={15} color={colors.primaryDark} />
            <Text style={styles.chipText}>{item.label}</Text>
            <Ionicons name="play" size={12} color={colors.primaryDark} />
          </Pressable>
        ))}
      </View>

      {Platform.OS !== "web" ? (
        <>
          <Text style={styles.section}>WHEN YOU'RE IN ANOTHER APP</Text>
          <View style={styles.statusRow}>
            <Ionicons
              name={push.status === "registered" ? "checkmark-circle" : "information-circle-outline"}
              size={18}
              color={push.status === "registered" ? colors.primary : colors.muted}
            />
            <Text style={[styles.text, styles.statusText]}>{PUSH_STATUS_TEXT[push.status]}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => void sendTest()}
            style={({ pressed }) => [styles.testButton, pressed && styles.pressed]}
          >
            <Ionicons name="notifications-outline" size={17} color={colors.primaryDark} />
            <Text style={styles.chipText}>Send a test notification</Text>
          </Pressable>
          {testNote ? <Text style={[styles.text, styles.testNote]}>{testNote}</Text> : null}
        </>
      ) : null}
    </AccountScreenFrame>
  );
}

const useStyles = makeStyles((__c) => {
  const colors = guardianPalette(__c);
  return StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  locked: { opacity: 0.9 },
  copy: { flex: 1 },
  title: { color: colors.ink, fontSize: 13.5, fontWeight: "800" },
  text: { marginTop: 2, color: colors.muted, fontSize: 11.5, lineHeight: 16 },
  loading: { marginVertical: 20 },
  footer: { marginTop: 14, marginBottom: 0 },
  section: { color: colors.muted, fontSize: 10.5, fontWeight: "900", letterSpacing: 1.2, marginTop: 22, marginBottom: 2 },
  previews: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    minHeight: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipText: { color: colors.primaryDark, fontSize: 12, fontWeight: "800" },
  pressed: { opacity: 0.7 },
  statusRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 10 },
  statusText: { flex: 1, marginTop: 0 },
  testButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 44,
    marginTop: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  testNote: { marginTop: 8 },
});
});
