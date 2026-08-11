import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../store/authStore";
import { fetchAdminSummaryMetrics } from "../../services/adminService";
import type { AdminSummaryMetrics } from "../../types/safetrack";
import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
  safeTrackSpacing as spacing,
} from "../../constants/safeTrackDesign";

type MetricTileProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  onPress?: () => void;
  iconColor?: string;
  iconBackground?: string;
};

function getFirstName(value?: string) {
  return value?.trim().split(/\s+/)[0] || "Administrator";
}

function MetricTile({
  icon,
  label,
  value,
  onPress,
  iconColor = colors.primary,
  iconBackground = colors.softMint,
}: MetricTileProps) {
  const content = (
    <>
      <View style={[styles.metricIcon, { backgroundColor: iconBackground }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>

      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </>
  );

  if (!onPress) {
    return <View style={styles.metricTile}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.metricTile,
        pressed && styles.pressed,
      ]}
    >
      {content}
    </Pressable>
  );
}

function SmallRecord({
  icon,
  label,
  value,
  color = colors.primary,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <View style={styles.smallRecord}>
      <View style={styles.smallRecordIcon}>
        <Ionicons name={icon} size={17} color={color} />
      </View>

      <View style={styles.smallRecordCopy}>
        <Text style={styles.smallRecordLabel}>{label}</Text>
        <Text style={styles.smallRecordValue}>{value}</Text>
      </View>
    </View>
  );
}

function CoverageRow({
  label,
  value,
  maximum,
}: {
  label: string;
  value: number;
  maximum: number;
}) {
  const progress = Math.min(1, value / Math.max(maximum, 1));

  return (
    <View style={styles.coverageRow}>
      <View style={styles.coverageHeader}>
        <Text style={styles.coverageLabel}>{label}</Text>
        <Text style={styles.coverageValue}>{value}</Text>
      </View>

      <View style={styles.coverageTrack}>
        <View
          style={[
            styles.coverageFill,
            {
              width: `${Math.max(progress * 100, value > 0 ? 6 : 0)}%`,
            },
          ]}
        />
      </View>
    </View>
  );
}

export function AdminHome() {
  const router = useRouter();
  const administrator = useAuthStore((state) => state.administrator);

  const [metrics, setMetrics] = useState<AdminSummaryMetrics | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const data = await fetchAdminSummaryMetrics();
      setMetrics(data);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to load SafeTrack system records."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  const coverageMaximum = useMemo(() => {
    if (!metrics) {
      return 1;
    }

    return Math.max(
      metrics.guardianAccounts,
      metrics.registeredChildren,
      metrics.activeDevices,
      metrics.locationRecords,
      1
    );
  }, [metrics]);

  const firstName = getFirstName(administrator?.fullName);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadMetrics(true)}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>SAFETRACK ADMINISTRATOR</Text>
            <Text style={styles.greeting}>Good day, {firstName}</Text>
            <Text style={styles.subtitle}>
              Authorized system records and connected SafeTrack activity.
            </Text>
          </View>

          <View style={styles.adminAvatar}>
            <Text style={styles.adminAvatarText}>
              {firstName.charAt(0).toUpperCase()}
            </Text>
          </View>
        </View>

        <LinearGradient
          colors={["#087B4A", "#0C9D5C", "#20B96F"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTop}>
            <View style={styles.heroBadge}>
              <View style={styles.heroDot} />
              <Text style={styles.heroBadgeText}>SYSTEM DATA READY</Text>
            </View>

            <Ionicons
              name="shield-checkmark-outline"
              size={30}
              color="rgba(255,255,255,0.78)"
            />
          </View>

          <Text style={styles.heroTitle}>
            Clarity for every approved admin action.
          </Text>

          <Text style={styles.heroText}>
            Review authorized Guardian, Child, Smartwatch, Safety, and Report
            records from one connected mobile workspace.
          </Text>

          <View style={styles.heroFooter}>
            <Pressable
              onPress={() => router.push("/admin-guardians")}
              style={({ pressed }) => [
                styles.heroButton,
                pressed && styles.heroPressed,
              ]}
            >
              <Text style={styles.heroButtonText}>Open guardian records</Text>
              <Ionicons
                name="arrow-forward"
                size={17}
                color={colors.primaryDark}
              />
            </Pressable>

            <View style={styles.heroStatus}>
              <Ionicons
                name="lock-closed-outline"
                size={13}
                color="rgba(255,255,255,0.86)"
              />
              <Text style={styles.heroStatusText}>Read-only records</Text>
            </View>
          </View>
        </LinearGradient>

        {loading && !metrics ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>
              Loading authorized system records...
            </Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons
              name="alert-circle-outline"
              size={22}
              color={colors.danger}
            />

            <View style={styles.errorCopy}>
              <Text style={styles.errorTitle}>Unable to load records</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>

            <Pressable
              onPress={() => void loadMetrics()}
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="refresh-outline"
                size={18}
                color={colors.primaryDark}
              />
            </Pressable>
          </View>
        ) : null}

        {metrics ? (
          <>
            <Text style={styles.sectionLabel}>PRIMARY RECORDS</Text>

            <View style={styles.metricsGrid}>
              <MetricTile
                icon="people-outline"
                label="Guardian Accounts"
                value={metrics.guardianAccounts}
                onPress={() => router.push("/admin-guardians")}
              />

              <MetricTile
                icon="watch-outline"
                label="Smartwatch Devices"
                value={metrics.activeDevices}
                onPress={() => router.push("/admin-devices")}
                iconColor="#2875A8"
                iconBackground="#E9F4FC"
              />

              <MetricTile
                icon="location-outline"
                label="Location Records"
                value={metrics.locationRecords}
                iconColor="#267C6B"
                iconBackground="#EAF8F2"
              />

              <MetricTile
                icon="document-text-outline"
                label="Activity Reports"
                value={metrics.generatedReports}
                onPress={() => router.push("/admin-reports")}
                iconColor="#B17B22"
                iconBackground="#FFF6E6"
              />
            </View>

            <Pressable
              onPress={() => setExpanded((value) => !value)}
              style={({ pressed }) => [
                styles.moreRecordsCard,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.moreRecordsTitleRow}>
                <View>
                  <Text style={styles.moreRecordsTitle}>
                    More system records
                  </Text>

                  <Text style={styles.moreRecordsText}>
                    Connected supporting data
                  </Text>
                </View>

                <View style={styles.moreRecordsChevron}>
                  <Ionicons
                    name={expanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={colors.primaryDark}
                  />
                </View>
              </View>

              {expanded ? (
                <View style={styles.smallRecordsGrid}>
                  <SmallRecord
                    icon="people-circle-outline"
                    label="Registered Children"
                    value={metrics.registeredChildren}
                  />

                  <SmallRecord
                    icon="shield-outline"
                    label="Active Safe Zones"
                    value={metrics.activeSafeZones}
                  />

                  <SmallRecord
                    icon="warning-outline"
                    label="Active SOS Alerts"
                    value={metrics.activeSosAlerts}
                    color={colors.danger}
                  />

                  <SmallRecord
                    icon="person-outline"
                    label="Admin Accounts"
                    value={metrics.administratorAccounts}
                  />
                </View>
              ) : null}
            </Pressable>

            <Text style={styles.sectionLabel}>ADMINISTRATIVE CONTEXT</Text>

            <View style={styles.contextCard}>
              <View style={styles.contextHeader}>
                <View>
                  <Text style={styles.contextTitle}>
                    Recent administrative context
                  </Text>

                  <Text style={styles.contextSubtitle}>
                    Current system availability overview
                  </Text>
                </View>

                <View style={styles.contextIcon}>
                  <Ionicons
                    name="pulse-outline"
                    size={20}
                    color={colors.primary}
                  />
                </View>
              </View>

              <View style={styles.contextRow}>
                <Ionicons
                  name="people-outline"
                  size={17}
                  color={colors.primary}
                />

                <Text style={styles.contextText}>
                  {metrics.guardianAccounts} Guardian account
                  {metrics.guardianAccounts === 1 ? "" : "s"} available for
                  authorized review.
                </Text>
              </View>

              <View style={styles.contextRow}>
                <Ionicons
                  name="watch-outline"
                  size={17}
                  color="#2875A8"
                />

                <Text style={styles.contextText}>
                  {metrics.activeDevices} active smartwatch device
                  {metrics.activeDevices === 1 ? "" : "s"} currently linked.
                </Text>
              </View>

              <View style={styles.contextRow}>
                <Ionicons
                  name={
                    metrics.activeSosAlerts > 0
                      ? "warning-outline"
                      : "checkmark-circle-outline"
                  }
                  size={17}
                  color={
                    metrics.activeSosAlerts > 0
                      ? colors.danger
                      : colors.primary
                  }
                />

                <Text style={styles.contextText}>
                  {metrics.activeSosAlerts > 0
                    ? `${metrics.activeSosAlerts} SOS alert${
                        metrics.activeSosAlerts === 1 ? "" : "s"
                      } currently require record review.`
                    : "No active SOS record currently requires review."}
                </Text>
              </View>
            </View>

            <View style={styles.coverageCard}>
              <View style={styles.contextHeader}>
                <View>
                  <Text style={styles.contextTitle}>Summary data coverage</Text>

                  <Text style={styles.contextSubtitle}>
                    Available records in the SafeTrack system
                  </Text>
                </View>

                <View style={styles.contextIcon}>
                  <Ionicons
                    name="bar-chart-outline"
                    size={20}
                    color={colors.primary}
                  />
                </View>
              </View>

              <CoverageRow
                label="Guardian accounts"
                value={metrics.guardianAccounts}
                maximum={coverageMaximum}
              />

              <CoverageRow
                label="Registered children"
                value={metrics.registeredChildren}
                maximum={coverageMaximum}
              />

              <CoverageRow
                label="Active smartwatch devices"
                value={metrics.activeDevices}
                maximum={coverageMaximum}
              />

              <CoverageRow
                label="Stored location records"
                value={metrics.locationRecords}
                maximum={coverageMaximum}
              />
            </View>

            <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>

            <View style={styles.actionsGrid}>
              <Pressable
                onPress={() => router.push("/admin-guardians")}
                style={({ pressed }) => [
                  styles.actionCard,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.actionIcon}>
                  <Ionicons
                    name="people-outline"
                    size={22}
                    color={colors.primary}
                  />
                </View>

                <Text style={styles.actionTitle}>Guardian Accounts</Text>
                <Text style={styles.actionText}>
                  Review Guardian-to-Child records.
                </Text>
              </Pressable>

              <Pressable
                onPress={() => router.push("/admin-devices")}
                style={({ pressed }) => [
                  styles.actionCard,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.actionIcon, styles.deviceActionIcon]}>
                  <Ionicons
                    name="watch-outline"
                    size={22}
                    color="#2875A8"
                  />
                </View>

                <Text style={styles.actionTitle}>Smartwatch Devices</Text>
                <Text style={styles.actionText}>
                  Review child-device linkage.
                </Text>
              </Pressable>

              <Pressable
                onPress={() => router.push("/admin-reports")}
                style={({ pressed }) => [
                  styles.actionCard,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.actionIcon, styles.reportActionIcon]}>
                  <Ionicons
                    name="document-text-outline"
                    size={22}
                    color="#B17B22"
                  />
                </View>

                <Text style={styles.actionTitle}>Reports</Text>
                <Text style={styles.actionText}>
                  Generate PDF or Excel-compatible CSV.
                </Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: 16,
    paddingBottom: 122,
  },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 18,
  },

  headerCopy: {
    flex: 1,
    marginRight: 14,
  },

  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
  },

  greeting: {
    color: colors.ink,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -0.8,
    marginTop: 4,
  },

  subtitle: {
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 4,
  },

  adminAvatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    ...shadow.soft,
  },

  adminAvatarText: {
    color: colors.white,
    fontSize: 21,
    fontWeight: "900",
  },

  hero: {
    overflow: "hidden",
    padding: 19,
    borderRadius: radius.lg,
    ...shadow.card,
  },

  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  heroDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#D5FFE4",
    marginRight: 6,
  },

  heroBadgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.9,
  },

  heroTitle: {
    maxWidth: 290,
    color: colors.white,
    fontSize: 23,
    lineHeight: 28,
    fontWeight: "900",
    letterSpacing: -0.6,
    marginTop: 18,
  },

  heroText: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: 8,
  },

  heroFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 17,
  },

  heroButton: {
    minHeight: 37,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
  },

  heroButtonText: {
    color: colors.primaryDark,
    fontSize: 10.5,
    fontWeight: "900",
    marginRight: 6,
  },

  heroStatus: {
    flexDirection: "row",
    alignItems: "center",
  },

  heroStatusText: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 9.5,
    fontWeight: "800",
    marginLeft: 5,
  },

  heroPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },

  loadingBox: {
    alignItems: "center",
    paddingVertical: 35,
  },

  loadingText: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 10,
  },

  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    marginTop: 16,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
  },

  errorCopy: {
    flex: 1,
    marginLeft: 8,
  },

  errorTitle: {
    color: colors.danger,
    fontSize: 12.5,
    fontWeight: "900",
  },

  errorText: {
    color: "#A75A5A",
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 2,
  },

  retryButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },

  sectionLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginTop: 22,
    marginBottom: 10,
  },

  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  metricTile: {
    width: "48.5%",
    minHeight: 144,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    marginBottom: 10,
    ...shadow.soft,
  },

  metricIcon: {
    width: 39,
    height: 39,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  metricValue: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 18,
  },

  metricLabel: {
    color: colors.muted,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "800",
    marginTop: 4,
  },

  moreRecordsCard: {
    padding: 15,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    ...shadow.soft,
  },

  moreRecordsTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  moreRecordsTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },

  moreRecordsText: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 3,
  },

  moreRecordsChevron: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
  },

  smallRecordsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 14,
  },

  smallRecord: {
    width: "48.5%",
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: radius.sm,
    backgroundColor: "#F7FBF8",
    marginBottom: 9,
  },

  smallRecordIcon: {
    width: 31,
    height: 31,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
  },

  smallRecordCopy: {
    flex: 1,
    marginLeft: 8,
  },

  smallRecordLabel: {
    color: colors.muted,
    fontSize: 9.5,
    fontWeight: "800",
  },

  smallRecordValue: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 2,
  },

  contextCard: {
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    ...shadow.soft,
  },

  coverageCard: {
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    marginTop: 11,
    ...shadow.soft,
  },

  contextHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  contextTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },

  contextSubtitle: {
    color: colors.muted,
    fontSize: 10.5,
    lineHeight: 15,
    marginTop: 3,
  },

  contextIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
  },

  contextRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderColor: colors.border,
  },

  contextText: {
    flex: 1,
    color: colors.muted,
    fontSize: 11.2,
    lineHeight: 16,
    marginLeft: 8,
  },

  coverageRow: {
    marginTop: 11,
  },

  coverageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  coverageLabel: {
    color: colors.muted,
    fontSize: 10.5,
    fontWeight: "700",
  },

  coverageValue: {
    color: colors.ink,
    fontSize: 10.5,
    fontWeight: "900",
  },

  coverageTrack: {
    height: 6,
    overflow: "hidden",
    borderRadius: 6,
    backgroundColor: "#EAF0EC",
    marginTop: 6,
  },

  coverageFill: {
    height: "100%",
    borderRadius: 6,
    backgroundColor: colors.primary,
  },

  actionsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  actionCard: {
    width: "31.5%",
    minHeight: 156,
    padding: 11,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    ...shadow.soft,
  },

  actionIcon: {
    width: 39,
    height: 39,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
  },

  deviceActionIcon: {
    backgroundColor: "#E9F4FC",
  },

  reportActionIcon: {
    backgroundColor: "#FFF6E6",
  },

  actionTitle: {
    color: colors.ink,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: "900",
    marginTop: 11,
  },

  actionText: {
    color: colors.muted,
    fontSize: 9.5,
    lineHeight: 13,
    marginTop: 5,
  },

  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.98 }],
  },
});