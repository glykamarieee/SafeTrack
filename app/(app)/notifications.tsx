import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
  Pressable,
} from "react-native";
import { Text } from "../../components/ui/NativeText";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter, type Href } from "expo-router";

import { useAuthStore } from "../../store/authStore";
import { useSosStore } from "../../store/sosStore";
import { fetchGeofenceEvents } from "../../services/geofenceService";
import type { GeofenceEvent } from "../../types/safetrack";
import {
  guardianColors as colors,
  guardianRadius as radius,
  guardianSpacing as spacing,
} from "../../constants/guardianDesign";

import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { guardianPalette } from "../../theme/legacy";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  icon: keyof typeof Ionicons.glyphMap;
  time: string;
  at: number;
  urgent: boolean;
  route: Href;
};

const EVENT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  entry: "enter-outline",
  exit: "exit-outline",
  possible_anomaly: "analytics-outline",
  watch_disconnected: "watch-outline",
  prolonged_inactivity: "hourglass-outline",
};

function formatTime(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * The same events the guardian is pushed (SOS, re-alerts and every
 * geofence_events row), newest first, from the stored records.
 */
export default function NotificationsScreen() {
  const styles = useStyles();
  const colors = guardianPalette(useTheme().colors);

  const router = useRouter();
  const child = useAuthStore((state) => state.linkedChildren?.[0] ?? null);
  const sosAlerts = useSosStore((state) => state.alerts);
  const loadSos = useSosStore((state) => state.loadForChild);
  const [events, setEvents] = useState<GeofenceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);

  const trackingSource = child?.trackingSource ?? "mobile";

  useFocusEffect(
    useCallback(() => {
      if (!child?.id) {
        setLoading(false);
        return;
      }
      let active = true;
      setLoading(true);
      setProblem(null);
      void loadSos(child.id, child.fullName);
      fetchGeofenceEvents(child.id, 40)
        .then((rows) => active && setEvents(rows))
        .catch((reason: { message?: string }) => active && setProblem(reason?.message ?? "Safety events could not be loaded."))
        .finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, [child?.id, child?.fullName, loadSos]),
  );

  const notifications: NotificationItem[] = [
    ...sosAlerts.map((alert) => ({
      id: `sos-${alert.id}`,
      title: alert.status === "active" ? `Active SOS from ${alert.childName ?? "your child"}` : "SOS alert",
      message:
        alert.status === "active"
          ? `Not acknowledged yet${alert.realertCount ? ` · re-alerted ${alert.realertCount}×` : ""}. Tap to respond.`
          : alert.status === "acknowledged"
            ? "Acknowledged."
            : "Cancelled.",
      icon: "warning-outline" as const,
      time: formatTime(alert.triggeredAt),
      at: Date.parse(alert.triggeredAt),
      urgent: alert.status === "active",
      route: "/(app)/sos-alerts" as Href,
    })),
    ...events.map((event) => ({
      id: `event-${event.id}`,
      title: event.title,
      message: event.details ?? event.eventType.replaceAll("_", " "),
      icon: EVENT_ICONS[event.eventType] ?? ("shield-checkmark-outline" as const),
      time: formatTime(event.occurredAt),
      at: Date.parse(event.occurredAt),
      urgent: false,
      route: (event.eventType === "possible_anomaly" ? "/(app)/anomaly-details" : "/(app)/history") as Href,
    })),
  ].sort((first, second) => second.at - first.at);

  const activeSOS = sosAlerts.filter((item) => item.status === "active").length;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          onPress={() => router.navigate("/(app)/home")}
        >
          <Ionicons name="chevron-back" size={19} color={colors.ink} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>SAFETY UPDATES</Text>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>
            SOS alerts and safety events for the selected child, newest first. The same events are sent as push notifications.
          </Text>
        </View>

        <View style={styles.contextBand}>
          <View style={styles.contextIcon}>
            <Ionicons name="person-outline" size={19} color={colors.primaryDark} />
          </View>
          <View style={styles.contextCopy}>
            <Text style={styles.contextLabel}>CURRENT CHILD</Text>
            <Text style={styles.contextValue}>{child?.fullName ?? "No child selected"}</Text>
          </View>
          <View style={styles.sourcePill}>
            <Ionicons
              name={trackingSource === "smartwatch" ? "watch-outline" : trackingSource === "both" ? "git-compare-outline" : "phone-portrait-outline"}
              size={14}
              color={colors.primaryDark}
            />
            <Text style={styles.sourceText}>
              {trackingSource === "smartwatch" ? "Watch" : trackingSource === "both" ? "Both" : "Mobile"}
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>RECENT ACTIVITY</Text>
            <Text style={styles.sectionTitle}>{activeSOS ? `${activeSOS} SOS need attention` : "Latest updates"}</Text>
          </View>
          <Text style={styles.countText}>{notifications.length} shown</Text>
        </View>

        {loading && !notifications.length ? <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} /> : null}
        {problem ? <Text style={[styles.message, { color: colors.danger, marginTop: 10 }]}>{problem}</Text> : null}
        {!loading && !notifications.length ? (
          <Text style={[styles.message, { marginTop: 14 }]}>No SOS alerts or safety events yet.</Text>
        ) : null}

        <View style={styles.noticeList}>
          {notifications.map((item, index) => {
            const urgent = item.urgent;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={() => router.navigate(item.route)}
                style={({ pressed }) => [
                  styles.noticeRow,
                  urgent && styles.noticeRowUrgent,
                  index !== notifications.length - 1 && styles.noticeDivider,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.iconBox, urgent && styles.iconBoxUrgent]}>
                  <Ionicons name={item.icon} size={20} color={urgent ? colors.danger : colors.primaryDark} />
                </View>
                <View style={styles.content}>
                  <View style={styles.row}>
                    <Text style={[styles.itemTitle, urgent && styles.itemTitleUrgent]}>{item.title}</Text>
                    <Text style={styles.time}>{item.time}</Text>
                  </View>
                  <Text style={styles.message}>{item.message}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.footnote}>
          <Ionicons name="information-circle-outline" size={17} color={colors.primaryDark} />
          <Text style={styles.footnoteText}>
            Showing the latest 40 safety events. The full day-by-day record is in Activity History.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((__c) => {
  const colors = guardianPalette(__c);
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { width: "100%", maxWidth: 960, alignSelf: "center", padding: spacing.lg, paddingBottom: 100 },
  back: { alignSelf: "flex-start", minHeight: 38, flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 18, borderRadius: radius.sm, paddingHorizontal: 3 },
  backText: { fontSize: 11.5, fontWeight: "800", color: colors.ink },
  header: { maxWidth: 680 },
  eyebrow: { fontSize: 9.5, fontWeight: "900", letterSpacing: 1.3, color: colors.primary },
  title: { marginTop: 4, fontSize: 30, fontWeight: "900", letterSpacing: -0.8, color: colors.ink },
  subtitle: { marginTop: 7, color: colors.muted, fontSize: 12.5, lineHeight: 19 },
  contextBand: { flexDirection: "row", alignItems: "center", gap: 11, marginTop: 24, paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  contextIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.softMint, alignItems: "center", justifyContent: "center" },
  contextCopy: { flex: 1 },
  contextLabel: { color: colors.muted, fontSize: 8.5, fontWeight: "900", letterSpacing: 1 },
  contextValue: { color: colors.ink, fontSize: 13, fontWeight: "900", marginTop: 2 },
  sourcePill: { minHeight: 29, flexDirection: "row", alignItems: "center", gap: 5, borderRadius: radius.pill, backgroundColor: colors.softMint, paddingHorizontal: 9 },
  sourceText: { color: colors.primaryDark, fontSize: 9.5, fontWeight: "900" },
  sectionHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 28, marginBottom: 10 },
  sectionEyebrow: { color: colors.primaryDark, fontSize: 9, fontWeight: "900", letterSpacing: 1.05 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "900", marginTop: 3 },
  countText: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  noticeList: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  noticeRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 17 },
  noticeRowUrgent: { backgroundColor: colors.dangerSoft, borderRadius: 16, paddingHorizontal: 10 },
  noticeDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  iconBox: { width: 42, height: 42, borderRadius: 15, backgroundColor: colors.softMint, justifyContent: "center", alignItems: "center" },
  iconBoxUrgent: { backgroundColor: colors.dangerSoft },
  content: { flex: 1, minWidth: 0 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  itemTitle: { flex: 1, fontSize: 13.5, fontWeight: "900", color: colors.ink },
  itemTitleUrgent: { color: colors.dangerDark },
  time: { fontSize: 9.5, fontWeight: "700", color: colors.muted },
  message: { marginTop: 5, color: colors.muted, fontSize: 11.5, lineHeight: 17 },
  footnote: { flexDirection: "row", alignItems: "flex-start", gap: 7, marginTop: 19 },
  footnoteText: { flex: 1, color: colors.muted, fontSize: 10.5, lineHeight: 16 },
  pressed: { opacity: 0.7 },
});
});
