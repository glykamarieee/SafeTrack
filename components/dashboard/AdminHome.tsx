import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import {
  fetchAdminSummaryMetrics,
  subscribeAdminUpdates,
} from "../../services/adminService";
import {
  adminColors as colors,
  adminLayout,
  adminRadius as radius,
  adminShadow as shadow,
  adminSpacing as spacing,
} from "../../constants/adminDesign";

function formatNumber(value: number) {
  return value.toLocaleString();
}

type AdminSummaryMetrics = {
  guardianAccounts: number;
  registeredChildren: number;
  activeDevices: number;
  activeSafeZones: number;
  locationRecords: number;
  activeSosAlerts: number;
  generatedReports: number;
};

type AdminAction = {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: "/(app)/admin-guardians" | "/(app)/admin-devices" | "/(app)/admin-reports";
};

const ACTIONS: AdminAction[] = [
  {
    title: "Guardian accounts",
    description: "Review registered guardians and update supported account status.",
    icon: "people-outline",
    route: "/(app)/admin-guardians",
  },
  {
    title: "Smartwatch devices",
    description: "Review linked watches, ownership context, and supported device status.",
    icon: "watch-outline",
    route: "/(app)/admin-devices",
  },
  {
    title: "System reports",
    description: "Retrieve authorized records and export the existing PDF or Excel reports.",
    icon: "document-text-outline",
    route: "/(app)/admin-reports",
  },
];

export function AdminHome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 1040;

  const [metrics, setMetrics] = useState<AdminSummaryMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    try {
      setError(null);
      const result = await fetchAdminSummaryMetrics();
      setMetrics(result);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to load dashboard data.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMetrics();
    const unsubscribe = subscribeAdminUpdates(() => void loadMetrics());
    return unsubscribe;
  }, [loadMetrics]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMetrics();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.centerState}>
        <View style={styles.stateMark}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
        <Text style={styles.stateTitle}>Loading administrator workspace</Text>
        <Text style={styles.stateText}>Retrieving authorized SafeTrack records.</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerState}>
        <View style={[styles.stateMark, styles.errorMark]}>
          <Ionicons name="warning-outline" size={24} color={colors.danger} />
        </View>
        <Text style={styles.stateTitle}>Dashboard could not be loaded</Text>
        <Text style={styles.stateText}>{error}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void loadMetrics()}
          style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
        >
          <Ionicons name="refresh" size={17} color={colors.white} />
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const data = metrics ?? {
    guardianAccounts: 0,
    registeredChildren: 0,
    activeDevices: 0,
    activeSafeZones: 0,
    locationRecords: 0,
    activeSosAlerts: 0,
    generatedReports: 0,
  };

  return (
    <ScrollView
      style={styles.screen}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void handleRefresh()}
          tintColor={colors.primary}
        />
      }
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>ADMINISTRATOR WORKSPACE</Text>
            <Text style={styles.title}>SafeTrack operations</Text>
            <Text style={styles.subtitle}>
              A concise view of the existing account, device, location, SOS, and report records available to the Administrator Module.
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Refresh administrator dashboard"
            onPress={() => void handleRefresh()}
            style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
          >
            <Ionicons name="refresh-outline" size={19} color={colors.primaryDark} />
            {wide ? <Text style={styles.refreshText}>Refresh</Text> : null}
          </Pressable>
        </View>

        <View style={[styles.workspace, wide && styles.workspaceWide]}>
          <View style={styles.primaryColumn}>
            <View style={styles.sectionHeadingRow}>
              <View>
                <Text style={styles.sectionEyebrow}>CURRENT RECORDS</Text>
                <Text style={styles.sectionTitle}>Operational overview</Text>
              </View>
              {data.activeSosAlerts > 0 ? (
                <View style={styles.attentionPill}>
                  <Ionicons name="alert-circle" size={15} color={colors.danger} />
                  <Text style={styles.attentionText}>
                    {formatNumber(data.activeSosAlerts)} active SOS
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.primaryMetrics}>
              <MetricLine
                icon="people-outline"
                label="Guardian accounts"
                value={data.guardianAccounts}
                detail="registered"
              />
              <MetricLine
                icon="watch-outline"
                label="Active smartwatch devices"
                value={data.activeDevices}
                detail="currently active"
              />
              <MetricLine
                icon="alert-circle-outline"
                label="Active SOS records"
                value={data.activeSosAlerts}
                detail="awaiting or active in stored data"
                danger={data.activeSosAlerts > 0}
                last
              />
            </View>

            <View style={styles.recordStrip}>
              <CompactMetric label="Children" value={data.registeredChildren} />
              <CompactMetric label="Safe zones" value={data.activeSafeZones} />
              <CompactMetric label="Location records" value={data.locationRecords} />
              <CompactMetric label="Reports" value={data.generatedReports} last />
            </View>

            <View style={styles.liveNote}>
              <View style={styles.liveDot} />
              <Text style={styles.liveNoteText}>
                This view refreshes from the existing administrator data subscriptions; no generated or placeholder records are shown.
              </Text>
            </View>
          </View>

          <View style={[styles.actionsColumn, wide && styles.actionsColumnWide]}>
            <Text style={styles.sectionEyebrow}>MANAGEMENT</Text>
            <Text style={styles.sectionTitle}>Administrative functions</Text>
            <Text style={styles.actionsIntro}>
              Open the existing SafeTrack workflows without leaving the current administrator role.
            </Text>

            <View style={styles.actionList}>
              {ACTIONS.map((action, index) => (
                <Pressable
                  key={action.title}
                  accessibilityRole="button"
                  onPress={() => router.push(action.route)}
                  style={({ pressed }) => [
                    styles.actionRow,
                    index !== ACTIONS.length - 1 && styles.actionDivider,
                    pressed && styles.actionPressed,
                  ]}
                >
                  <View style={styles.actionIcon}>
                    <Ionicons name={action.icon} size={20} color={colors.primary} />
                  </View>
                  <View style={styles.actionCopy}>
                    <Text style={styles.actionTitle}>{action.title}</Text>
                    <Text style={styles.actionDescription}>{action.description}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={19} color={colors.subtle} />
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.boundaryNote}>
          <Ionicons name="shield-checkmark-outline" size={19} color={colors.primary} />
          <Text style={styles.boundaryText}>
            Administrator actions remain limited to the functions already provided by SafeTrack. Historical location, geofence, SOS, and activity records are presented for authorized use and are not edited from this workspace.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function MetricLine({
  icon,
  label,
  value,
  detail,
  danger = false,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  detail: string;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.metricLine, !last && styles.metricDivider]}>
      <View style={[styles.metricIcon, danger && styles.metricIconDanger]}>
        <Ionicons name={icon} size={19} color={danger ? colors.danger : colors.primary} />
      </View>
      <View style={styles.metricLabelWrap}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricDetail}>{detail}</Text>
      </View>
      <Text style={[styles.metricValue, danger && styles.metricValueDanger]}>
        {formatNumber(value)}
      </Text>
    </View>
  );
}

function CompactMetric({
  label,
  value,
  last = false,
}: {
  label: string;
  value: number;
  last?: boolean;
}) {
  return (
    <View style={[styles.compactMetric, !last && styles.compactDivider]}>
      <Text style={styles.compactValue}>{formatNumber(value)}</Text>
      <Text style={styles.compactLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 110 },
  page: {
    width: "100%",
    maxWidth: adminLayout.pageMax,
    alignSelf: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: 28,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.lg,
  },
  headerCopy: { flex: 1, maxWidth: 780 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 31, lineHeight: 37, fontWeight: "800", letterSpacing: -0.9, marginTop: 5 },
  subtitle: { color: colors.muted, fontSize: 13.5, lineHeight: 21, marginTop: 8 },
  refreshButton: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 13,
  },
  refreshText: { color: colors.primaryDark, fontSize: 12, fontWeight: "800" },
  workspace: { marginTop: 34, gap: 30 },
  workspaceWide: { flexDirection: "row", alignItems: "stretch", gap: 38 },
  primaryColumn: { flex: 1.45, minWidth: 0 },
  actionsColumn: { flex: 1, minWidth: 0 },
  actionsColumnWide: {
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    paddingLeft: 34,
  },
  sectionHeadingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 14 },
  sectionEyebrow: { color: colors.muted, fontSize: 9.5, fontWeight: "900", letterSpacing: 1.25 },
  sectionTitle: { color: colors.ink, fontSize: 20, lineHeight: 25, fontWeight: "800", letterSpacing: -0.35, marginTop: 5 },
  attentionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    minHeight: 30,
  },
  attentionText: { color: colors.danger, fontSize: 11, fontWeight: "800" },
  primaryMetrics: {
    marginTop: 17,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 18,
    ...shadow.soft,
  },
  metricLine: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 13 },
  metricDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  metricIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  metricIconDanger: { backgroundColor: colors.dangerSoft },
  metricLabelWrap: { flex: 1 },
  metricLabel: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  metricDetail: { color: colors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 2 },
  metricValue: { color: colors.ink, fontSize: 22, fontWeight: "800", letterSpacing: -0.45 },
  metricValueDanger: { color: colors.danger },
  recordStrip: {
    flexDirection: "row",
    marginTop: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: 15,
  },
  compactMetric: { flex: 1, paddingHorizontal: 10, minWidth: 0 },
  compactDivider: { borderRightWidth: 1, borderRightColor: colors.border },
  compactValue: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  compactLabel: { color: colors.muted, fontSize: 10.5, lineHeight: 15, marginTop: 3 },
  liveNote: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 14 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primaryBright, marginTop: 6 },
  liveNoteText: { flex: 1, color: colors.muted, fontSize: 11.5, lineHeight: 18 },
  actionsIntro: { color: colors.muted, fontSize: 12.5, lineHeight: 19, marginTop: 7 },
  actionList: { marginTop: 11 },
  actionRow: { minHeight: 84, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13 },
  actionDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  actionPressed: { opacity: 0.72, transform: [{ translateX: 2 }] },
  actionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  actionCopy: { flex: 1 },
  actionTitle: { color: colors.ink, fontSize: 13.5, fontWeight: "800" },
  actionDescription: { color: colors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  boundaryNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 34,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 18,
  },
  boundaryText: { flex: 1, color: colors.muted, fontSize: 11.5, lineHeight: 18 },
  centerState: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, padding: 28 },
  stateMark: { width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  errorMark: { backgroundColor: colors.dangerSoft },
  stateTitle: { color: colors.ink, fontSize: 17, fontWeight: "800", marginTop: 15, textAlign: "center" },
  stateText: { color: colors.muted, fontSize: 12.5, lineHeight: 19, marginTop: 5, textAlign: "center", maxWidth: 440 },
  retry: { marginTop: 17, minHeight: 42, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 16 },
  retryText: { color: colors.white, fontSize: 12, fontWeight: "800" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
