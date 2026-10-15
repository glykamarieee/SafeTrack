import { useCallback, useState } from "react";
import {
  ActivityIndicator,
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

import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { guardianPalette } from "../../theme/legacy";

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
});
});
