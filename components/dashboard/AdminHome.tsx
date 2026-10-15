import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { ActivityIndicator, Animated, Easing, Pressable, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import {
  fetchAdminSmartwatchDevices,
  fetchAdminSummaryMetrics,
  subscribeAdminUpdates,
  type AdminSmartwatchDevice,
} from "../../services/adminService";
import { WatchIllustration } from "../admin/WatchIllustration";
import { Button } from "../ui/Button";
import { Entrance } from "../ui/Entrance";
import { Notice } from "../ui/Notice";
import { Text } from "../ui/Text";
import { nativeDriver } from "../../theme/motion";
import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { radius, shadow, space } from "../../theme/tokens";

type AdminSummaryMetrics = {
  guardianAccounts: number;
  registeredChildren: number;
  activeDevices: number;
  activeSafeZones: number;
  locationRecords: number;
  activeSosAlerts: number;
  generatedReports: number;
};

const EMPTY_METRICS: AdminSummaryMetrics = {
  guardianAccounts: 0,
  registeredChildren: 0,
  activeDevices: 0,
  activeSafeZones: 0,
  locationRecords: 0,
  activeSosAlerts: 0,
  generatedReports: 0,
};

const TIPS_KEY = "safetrack.adminTips";

type IconName = ComponentProps<typeof Ionicons>["name"];

function formatNumber(value: number) {
  return value.toLocaleString("en-PH");
}

function ago(value?: string | null) {
  if (!value) return "No location yet";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "—";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function initials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function today() {
  return new Intl.DateTimeFormat("en-PH", { weekday: "long", day: "numeric", month: "long" }).format(new Date()).toUpperCase();
}

export function AdminHome() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 1180;
  const tablet = width >= 760;

  const [metrics, setMetrics] = useState<AdminSummaryMetrics | null>(null);
  const [devices, setDevices] = useState<AdminSmartwatchDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [showTips, setShowTips] = useState(false);

  const loadMetrics = useCallback(async () => {
    try {
      setError(null);
      const [result, deviceList] = await Promise.all([
        fetchAdminSummaryMetrics(),
        // The device list is extra context; the dashboard still works without it.
        fetchAdminSmartwatchDevices("").catch(() => [] as AdminSmartwatchDevice[]),
      ]);
      setMetrics(result);
      setDevices(deviceList);
      setLastUpdated(new Date().toISOString());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMetrics();
    const unsubscribe = subscribeAdminUpdates(() => {
      void loadMetrics();
    });
    return unsubscribe;
  }, [loadMetrics]);

  useEffect(() => {
    AsyncStorage.getItem(TIPS_KEY)
      .then((value) => setShowTips(value !== "dismissed"))
      .catch(() => setShowTips(true));
  }, []);

  const dismissTips = () => {
    setShowTips(false);
    AsyncStorage.setItem(TIPS_KEY, "dismissed").catch(() => undefined);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMetrics();
    setRefreshing(false);
  };

  const data = metrics ?? EMPTY_METRICS;

  const recentDevices = useMemo(
    () =>
      [...devices]
        .sort((first, second) => (Date.parse(second.latestLocationAt ?? "") || 0) - (Date.parse(first.latestLocationAt ?? "") || 0))
        .slice(0, 5),
    [devices],
  );
  const featured = recentDevices.find((device) => device.isActive) ?? recentDevices[0] ?? null;

  const bars = [
    { label: "Guardians", value: data.guardianAccounts },
    { label: "Children", value: data.registeredChildren },
    { label: "Active devices", value: data.activeDevices },
    { label: "Safe zones", value: data.activeSafeZones },
    { label: "Reports", value: data.generatedReports },
    { label: "Active SOS", value: data.activeSosAlerts, danger: true },
  ];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
        <Text variant="label" tone="muted">
          Preparing the operations view
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <View style={styles.errorCard}>
          <Notice tone="error" title="Dashboard could not be loaded">
            {error}
          </Notice>
          <Button label="Try again" icon="refresh" onPress={() => void loadMetrics()} />
        </View>
      </View>
    );
  }

  const openDevice = (deviceId: string) => router.push({ pathname: "/(app)/admin-device-details", params: { deviceId } });

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={colors.primary} />}
    >
      <Entrance index={0} style={styles.header}>
        <View style={styles.headerCopy}>
          <Text variant="legend" tone="primary">
            {today()}
          </Text>
          <Text variant="display" accessibilityRole="header">
            Dashboard
          </Text>
          <Text variant="caption">Updated {ago(lastUpdated)} · totals refresh when records change</Text>
        </View>
        <View style={styles.headerActions}>
          <Button label="Refresh" variant="secondary" size="sm" icon="refresh" loading={refreshing} onPress={() => void handleRefresh()} />
          <Button label="Export report" variant="forest" size="sm" icon="download-outline" onPress={() => router.push("/(app)/admin-reports")} />
        </View>
      </Entrance>

      {showTips ? (
        <Entrance index={1} style={styles.tips}>
          <View style={styles.tipsIcon}>
            <Ionicons name="bulb-outline" size={18} color={colors.onPrimary} />
          </View>
          <Text variant="label" weight="500" tone="ink" style={styles.flex}>
            <Text variant="label" weight="800" tone="ink">
              Tip:{" "}
            </Text>
            open a guardian to see their children, devices and SOS history. Records lists SOS, locations and safety events by day; Reports
            exports PDF or Excel.
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss tip" onPress={dismissTips} hitSlop={8} style={styles.tipsClose}>
            <Ionicons name="close" size={18} color={colors.primary} />
          </Pressable>
        </Entrance>
      ) : null}

      <View style={[styles.stats, !tablet && styles.statsStacked]}>
        <StatCard index={2} strong icon="watch-outline" label="Active devices" value={formatNumber(data.activeDevices)} detail="Watches linked and active" onPress={() => router.push("/(app)/admin-devices")} />
        <StatCard index={3} icon="people-outline" label="Guardians" value={formatNumber(data.guardianAccounts)} detail="Guardian accounts" onPress={() => router.push("/(app)/admin-guardians")} />
        <StatCard index={4} icon="happy-outline" label="Children" value={formatNumber(data.registeredChildren)} detail="Registered children" onPress={() => router.push("/(app)/admin-guardians")} />
        <StatCard
          index={5}
          icon="alert-circle-outline"
          label="Active SOS"
          value={formatNumber(data.activeSosAlerts)}
          detail={data.activeSosAlerts > 0 ? "Needs acknowledgement" : "None right now"}
          danger={data.activeSosAlerts > 0}
          onPress={() => router.push("/(app)/admin-records")}
        />
      </View>

      <View style={[styles.grid, wide && styles.gridWide]}>
        <View style={styles.mainColumn}>
          <Entrance index={6} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.flex}>
                <Text variant="heading">Records at a glance</Text>
                <Text variant="caption">Current totals stored in SafeTrack</Text>
              </View>
            </View>
            <BarChart bars={bars} />
          </Entrance>

          <Entrance index={7} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.flex}>
                <Text variant="heading">Devices</Text>
                <Text variant="caption">Most recently seen first</Text>
              </View>
              <Button label="View all" variant="soft" size="sm" iconRight="arrow-forward" onPress={() => router.push("/(app)/admin-devices")} />
            </View>
            {recentDevices.length === 0 ? (
              <Text variant="label" tone="muted" style={styles.empty}>
                No smartwatch devices are registered yet.
              </Text>
            ) : (
              <View>
                {tablet ? (
                  <View style={styles.tableHead}>
                    <Text variant="legend" style={styles.colChild}>Child</Text>
                    <Text variant="legend" style={styles.colWatch}>Watch ID</Text>
                    <Text variant="legend" style={styles.colGuardian}>Guardian</Text>
                    <Text variant="legend" style={styles.colSeen}>Last location</Text>
                    <Text variant="legend" style={styles.colStatus}>Status</Text>
                  </View>
                ) : null}
                {recentDevices.map((device) => (
                  <Pressable
                    key={device.deviceId}
                    accessibilityRole="button"
                    accessibilityLabel={`${device.childName}, ${device.watchId}, ${device.isActive ? "active" : "inactive"}. Open device`}
                    onPress={() => openDevice(device.deviceId)}
                    style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.row, (pressed || hovered) && styles.rowHover]}
                  >
                    <View style={[styles.colChild, styles.childCell]}>
                      <View style={[styles.avatar, !device.isActive && styles.avatarOff]}>
                        <Text variant="caption" weight="800" tone={device.isActive ? "primary" : "ink2"}>
                          {initials(device.childName)}
                        </Text>
                      </View>
                      <Text variant="label" weight="700" numberOfLines={1} style={styles.flex}>
                        {device.childName}
                      </Text>
                    </View>
                    {tablet ? (
                      <>
                        <Text variant="label" tone="ink2" numberOfLines={1} style={styles.colWatch}>
                          {device.watchId}
                        </Text>
                        <Text variant="label" tone="ink2" numberOfLines={1} style={styles.colGuardian}>
                          {device.guardianName}
                        </Text>
                        <Text variant="label" tone="ink2" numberOfLines={1} style={styles.colSeen} tabular>
                          {ago(device.latestLocationAt)}
                        </Text>
                      </>
                    ) : null}
                    <View style={styles.colStatus}>
                      <View style={[styles.tag, device.isActive ? styles.tagOn : styles.tagOff]}>
                        <Text variant="caption" weight="800" tone={device.isActive ? "primary" : "ink2"}>
                          {device.isActive ? "Active" : "Inactive"}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </Entrance>
        </View>

        <View style={[styles.sideColumn, wide && styles.sideColumnWide]}>
          <Entrance index={6} style={styles.featured}>
            <Text variant="legend" tone="primary">
              Featured device
            </Text>
            {featured ? (
              <>
                <View>
                  <Text variant="heading" weight="800">
                    {featured.watchId}
                  </Text>
                  <Text variant="caption">
                    {featured.childName} · Guardian {featured.guardianName}
                  </Text>
                </View>
                <View style={styles.watchWrap}>
                  <WatchIllustration size={150} />
                </View>
                <View style={styles.chips}>
                  <View style={styles.chip}>
                    <Ionicons name="location-outline" size={16} color={colors.primary} />
                    <View>
                      <Text variant="label" weight="800" tabular>
                        {ago(featured.latestLocationAt)}
                      </Text>
                      <Text variant="caption">Last location</Text>
                    </View>
                  </View>
                  <View style={styles.chip}>
                    <Ionicons name={featured.isActive ? "checkmark-circle-outline" : "pause-circle-outline"} size={16} color={colors.primary} />
                    <View>
                      <Text variant="label" weight="800">
                        {featured.isActive ? "Active" : "Inactive"}
                      </Text>
                      <Text variant="caption">Status</Text>
                    </View>
                  </View>
                </View>
                <Button label="Open device" variant="primary" size="sm" iconRight="arrow-forward" onPress={() => openDevice(featured.deviceId)} />
              </>
            ) : (
              <>
                <View style={styles.watchWrap}>
                  <WatchIllustration size={150} />
                </View>
                <Text variant="label" tone="muted">
                  No smartwatch devices yet. Paired watches appear here.
                </Text>
              </>
            )}
          </Entrance>

          <Entrance index={7} style={styles.locationCard}>
            <Text variant="legend" style={styles.locationLegend}>
              Location records
            </Text>
            <Text variant="display" weight="800" style={styles.white} tabular>
              {formatNumber(data.locationRecords)}
            </Text>
            <Text variant="caption" style={styles.locationSoft}>
              Points stored from watches and phones. Each one is the latest position a device sent, not a live feed.
            </Text>
            <View style={styles.quickLinks}>
              <QuickLink icon="list-outline" label="Records" onPress={() => router.push("/(app)/admin-records")} />
              <QuickLink icon="people-outline" label="Guardians" onPress={() => router.push("/(app)/admin-guardians")} />
              <QuickLink icon="document-text-outline" label="Reports" onPress={() => router.push("/(app)/admin-reports")} />
            </View>
          </Entrance>
        </View>
      </View>
    </ScrollView>
  );
}

function StatCard({
  index,
  icon,
  label,
  value,
  detail,
  strong,
  danger,
  onPress,
}: {
  index: number;
  icon: IconName;
  label: string;
  value: string;
  detail: string;
  strong?: boolean;
  danger?: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <Entrance index={index} style={styles.statCell}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}. ${detail}`}
        onPress={onPress}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
          styles.stat,
          strong && styles.statStrong,
          danger && styles.statDanger,
          (pressed || hovered) && styles.statHover,
        ]}
      >
        <View style={styles.statTop}>
          <Text variant="legend" style={strong ? styles.forestSoft : danger ? { color: colors.danger } : undefined}>
            {label}
          </Text>
          <View style={[styles.statIcon, strong && styles.statIconStrong, danger && { backgroundColor: colors.dangerTint }]}>
            <Ionicons name={icon} size={18} color={strong ? "#3DDC84" : danger ? colors.danger : colors.primary} />
          </View>
        </View>
        <Text variant="display" weight="800" tabular style={strong ? styles.white : danger ? { color: colors.danger } : undefined}>
          {value}
        </Text>
        <Text variant="caption" style={strong ? styles.forestSoft : undefined}>
          {detail}
        </Text>
      </Pressable>
    </Entrance>
  );
}

/** Horizontal-axis bars of the current totals; the largest is highlighted. Bars grow in once. */
function BarChart({ bars }: { bars: { label: string; value: number; danger?: boolean }[] }) {
  const styles = useStyles();
  const { colors, reduceMotion, scheme } = useTheme();
  const grow = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  const top = bars.reduce((best, bar) => (bar.value > best.value ? bar : best), bars[0]);

  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(grow, { toValue: 1, duration: 800, delay: 250, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }).start();
  }, [grow, reduceMotion]);

  return (
    <View style={styles.chart} accessibilityRole="summary" accessibilityLabel={bars.map((bar) => `${bar.label} ${bar.value}`).join(", ")}>
      {bars.map((bar) => {
        const share = bar.value / max;
        const highlight = bar === top && bar.value > 0;
        return (
          <View key={bar.label} style={styles.barColumn}>
            <Text variant="label" weight="800" tabular tone={bar.danger && bar.value > 0 ? "danger" : "ink"}>
              {formatNumber(bar.value)}
            </Text>
            <View style={styles.barTrack}>
              <Animated.View
                style={[
                  styles.bar,
                  {
                    height: `${Math.max(4, share * 100)}%`,
                    backgroundColor: bar.danger && bar.value > 0 ? colors.danger : highlight ? (scheme === "dark" ? colors.ink : colors.forest) : colors.brand,
                    transform: [{ scaleY: grow }],
                  },
                ]}
              />
            </View>
            <Text variant="caption" numberOfLines={1} align="center">
              {bar.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function QuickLink({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.quickLink, (pressed || hovered) && styles.quickLinkHover]}
    >
      <Ionicons name={icon} size={17} color="#3DDC84" />
      <Text variant="label" weight="700" style={styles.white}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c, scheme) => {
  const card = {
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: scheme === "dark" ? c.rule : "transparent", ...(scheme === "dark" ? {} : shadow(scheme)),
  };

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.paper },
    content: { width: "100%", maxWidth: 1320, alignSelf: "center", padding: space.lg, paddingTop: space.xl, paddingBottom: 120, gap: space.lg },
    flex: { flex: 1, minWidth: 0 },
    white: { color: "#FFFFFF" },
    forestSoft: { color: "#9FC3AE" },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, padding: space.xl, backgroundColor: c.paper },
    errorCard: { width: "100%", maxWidth: 460, gap: space.md },
    header: { flexDirection: "row", alignItems: "flex-end", flexWrap: "wrap", gap: space.lg },
    headerCopy: { flex: 1, minWidth: 260 },
    headerActions: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
    tips: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.sm, backgroundColor: c.primaryTint },
    tipsIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: c.primary },
    tipsClose: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    stats: { flexDirection: "row", gap: space.md },
    statsStacked: { flexWrap: "wrap" },
    statCell: { flex: 1, minWidth: 150 },
    stat: { ...card, padding: space.lg, gap: space.xs, minHeight: 132 },
    statStrong: { backgroundColor: scheme === "dark" ? c.forest : "#0D2A1E", borderWidth: 0 },
    statDanger: { borderWidth: 1.5, borderColor: c.danger },
    statHover: { opacity: 0.92 },
    statTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.xs },
    statIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: c.primaryTint },
    statIconStrong: { backgroundColor: "#163D2B" },
    grid: { gap: space.lg },
    gridWide: { flexDirection: "row", alignItems: "flex-start" },
    mainColumn: { flex: 1, minWidth: 0, gap: space.lg },
    sideColumn: { gap: space.lg },
    sideColumnWide: { width: 340 },
    card: { ...card, padding: space.lg, gap: space.md },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: space.md },
    empty: { paddingVertical: space.lg },
    chart: { flexDirection: "row", alignItems: "flex-end", gap: space.md, height: 230, paddingTop: space.sm },
    barColumn: { flex: 1, minWidth: 0, alignItems: "center", gap: 6, height: "100%" },
    barTrack: { flex: 1, width: "100%", maxWidth: 64, justifyContent: "flex-end", borderRadius: 10, backgroundColor: c.sunken, overflow: "hidden" },
    bar: { width: "100%", borderRadius: 10, transformOrigin: "bottom" },
    tableHead: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.sm, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: c.rule },
    row: { flexDirection: "row", alignItems: "center", minHeight: 56, paddingHorizontal: space.sm, borderBottomWidth: 1, borderBottomColor: c.rule, borderRadius: 10 },
    rowHover: { backgroundColor: c.sunken },
    colChild: { flex: 1.6, minWidth: 0 },
    colWatch: { flex: 1.3, minWidth: 0 },
    colGuardian: { flex: 1.4, minWidth: 0 },
    colSeen: { flex: 1.1, minWidth: 0 },
    colStatus: { width: 96, alignItems: "flex-start" },
    childCell: { flexDirection: "row", alignItems: "center", gap: space.sm },
    avatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: c.brand, backgroundColor: c.primaryTint, alignItems: "center", justifyContent: "center" },
    avatarOff: { borderColor: c.offline, backgroundColor: c.offlineTint },
    tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
    tagOn: { backgroundColor: c.primaryTint },
    tagOff: { backgroundColor: c.offlineTint },
    featured: { borderRadius: radius.md, padding: space.lg, gap: space.md, backgroundColor: scheme === "dark" ? c.primaryTint : "#E1F2E7" },
    watchWrap: { alignItems: "center", paddingVertical: space.sm },
    chips: { flexDirection: "row", gap: space.sm },
    chip: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.md, borderRadius: radius.sm, backgroundColor: c.surface },
    locationCard: { borderRadius: radius.md, padding: space.lg, gap: space.sm, backgroundColor: scheme === "dark" ? c.forest : "#0D2A1E" },
    locationLegend: { color: "#9FC3AE" },
    locationSoft: { color: "#BFD8C9" },
    quickLinks: { gap: 6, marginTop: space.sm },
    quickLink: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 42, paddingHorizontal: space.md, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.06)" },
    quickLinkHover: { backgroundColor: "rgba(255,255,255,0.12)" },
  });
});
