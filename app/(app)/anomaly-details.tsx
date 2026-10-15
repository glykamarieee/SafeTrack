import { useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "../../components/ui/NativeText";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import { useAuthStore } from "../../store/authStore";
import { useAnomalyStore } from "../../store/anomalyStore";
import type { SafetyTimelineItem } from "../../services/safetyEventsService";
import {
  guardianColors as colors,
  guardianRadius as radius,
  guardianSpacing as spacing,
} from "../../constants/guardianDesign";

/**
 * The server writes reasons as "Possible unusual movement: a, b, c. Advisory only."
 * Split them back into a list; fall back to the whole text.
 */
function reasonsOf(details: string | null) {
  if (!details) return [];
  const match = details.match(/:\s*(.+?)\.\s*(Advisory only\.?)?$/);
  if (!match) return [];
  return match[1]!.split(/,\s*/).filter(Boolean);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function NoticeCard({ notice }: { notice: SafetyTimelineItem }) {
  const reasons = reasonsOf(notice.details);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}>
          <Ionicons name="analytics-outline" size={18} color={colors.warning} />
        </View>
        <View style={styles.cardCopy}>
          <Text style={styles.cardTitle}>{notice.title}</Text>
          <Text style={styles.cardTime}>{formatDateTime(notice.occurredAt)}</Text>
        </View>
        {notice.anomalyScore != null ? (
          <View style={styles.scoreChip}>
            <Text style={styles.scoreText}>Score {notice.anomalyScore.toFixed(2)}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.sectionLabel}>Why it was flagged</Text>
      {reasons.length ? (
        reasons.map((reason) => (
          <View key={reason} style={styles.reasonRow}>
            <Ionicons name="ellipse" size={6} color={colors.warning} />
            <Text style={styles.reasonText}>{reason.charAt(0).toUpperCase() + reason.slice(1)}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.reasonText}>{notice.details ?? "Unusual compared with this child's usual pattern."}</Text>
      )}

      {notice.latitude != null && notice.longitude != null ? (
        <Text style={styles.position}>
          Location: {notice.latitude.toFixed(5)}, {notice.longitude.toFixed(5)}
        </Text>
      ) : null}
    </View>
  );
}

export default function AnomalyDetailsScreen() {
  const router = useRouter();
  const child = useAuthStore((state) => state.linkedChildren?.[0] ?? null);
  const anomalies = useAnomalyStore((state) => state.anomalies);
  const isLoading = useAnomalyStore((state) => state.isLoading);
  const error = useAnomalyStore((state) => state.error);
  const load = useAnomalyStore((state) => state.loadForChild);

  useFocusEffect(
    useCallback(() => {
      if (child?.id) void load(child.id);
    }, [child?.id, load]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={() => child?.id && void load(child.id)} tintColor={colors.primary} />
        }
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to home"
            onPress={() => router.navigate("/(app)/home")}
            style={styles.back}
          >
            <Ionicons name="arrow-back" size={20} color={colors.primaryDeep} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>AI safety notices</Text>
            <Text style={styles.subtitle}>{child?.fullName ?? "Your child"}'s recent unusual-movement notices</Text>
          </View>
        </View>

        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.noteText}>
            Notices are advisory. SafeTrack compares each new location with this child's own earlier locations and lists what
            stood out. They are not emergencies; SOS alerts are separate.
          </Text>
        </View>

        {isLoading && !anomalies.length ? (
          <ActivityIndicator style={styles.loading} color={colors.primary} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : anomalies.length ? (
          anomalies.map((notice) => <NoticeCard key={notice.id} notice={notice} />)
        ) : (
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle-outline" size={28} color={colors.primaryDark} />
            <Text style={styles.emptyTitle}>No AI notices</Text>
            <Text style={styles.emptyText}>Nothing unusual has been flagged for this child.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { width: "100%", maxWidth: 820, alignSelf: "center", padding: spacing.lg, paddingBottom: 120 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  back: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerCopy: { flex: 1, marginLeft: 12 },
  title: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  subtitle: { marginTop: 2, color: colors.muted, fontSize: 12.5 },
  note: { flexDirection: "row", gap: 8, padding: 12, borderRadius: radius.md, backgroundColor: colors.softMint, marginBottom: 14 },
  noteText: { flex: 1, color: colors.primaryDeep, fontSize: 11.5, lineHeight: 16 },
  loading: { marginTop: 30 },
  error: { color: colors.danger, fontSize: 12.5 },
  card: { padding: 14, marginBottom: 10, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: "row", alignItems: "center" },
  cardIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.warningSoft },
  cardCopy: { flex: 1, marginLeft: 10 },
  cardTitle: { color: colors.ink, fontSize: 13.5, fontWeight: "800" },
  cardTime: { marginTop: 2, color: colors.muted, fontSize: 11 },
  scoreChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  scoreText: { color: colors.primaryDark, fontSize: 10.5, fontWeight: "800" },
  sectionLabel: { marginTop: 12, marginBottom: 6, color: colors.muted, fontSize: 10.5, fontWeight: "800", letterSpacing: 0.6 },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 3 },
  reasonText: { flex: 1, color: colors.ink, fontSize: 12.5, lineHeight: 18 },
  position: { marginTop: 10, color: colors.muted, fontSize: 11 },
  empty: { alignItems: "center", padding: 28, gap: 6 },
  emptyTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  emptyText: { color: colors.muted, fontSize: 12, textAlign: "center" },
});
