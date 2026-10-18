import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

import {
  fetchAdminSmartwatchDevices,
  fetchAdminSummaryMetrics,
  subscribeAdminUpdates,
  type AdminSmartwatchDevice,
} from "../../services/adminService";
import {
  fetchAdminActivityFeed,
  fetchAdminWeek,
  type AdminActivityItem,
  type AdminDayCount,
} from "../../services/adminRecordsService";
import { useAuthStore } from "../../store/authStore";
import { WatchIllustration } from "../admin/WatchIllustration";
import {
  CountUp,
  LivePulse,
  Lift,
  Rise,
  Skeleton,
  TonePill,
  formatNumber,
  phTime,
  timeAgo,
  toneFor,
  useFlash,
  useTone,
  type IconName,
} from "../admin/kit";
import { Button } from "../ui/Button";
import { MapPattern } from "../ui/MapPattern";
import { Text } from "../ui/Text";
import { nativeDriver } from "../../theme/motion";
import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { radius, space } from "../../theme/tokens";

type Metrics = Awaited<ReturnType<typeof fetchAdminSummaryMetrics>>;

/** "SUNDAY, OCTOBER 18" in Philippine time. */
function todayLabel() {
  return new Intl.DateTimeFormat("en-PH", { weekday: "long", month: "long", day: "numeric", timeZone: "Asia/Manila" })
    .format(new Date())
    .toUpperCase();
}

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Manila" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

/** Fresh < 10 min, recent < 1 h, otherwise old. */
function freshness(value: string | null | undefined): "fresh" | "recent" | "old" {
  const at = Date.parse(value ?? "");
  if (!Number.isFinite(at)) return "old";
  const minutes = (Date.now() - at) / 60000;
  return minutes < 10 ? "fresh" : minutes < 60 ? "recent" : "old";
}

/**
 * The administrator's "control room": a forest hero with a one-line system
 * status, five figures with their own treatments, the last 7 days, a live
 * activity feed and a device spotlight. Every figure comes from the admin
 * services; while loading the screen shows its own skeleton, never zeros.
 */
export function AdminHome() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 1180;
  const tablet = width >= 760;
  const adminName = useAuthStore((state) => state.administrator?.fullName ?? "");

  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [devices, setDevices] = useState<AdminSmartwatchDevice[]>([]);
  const [week, setWeek] = useState<AdminDayCount[] | null>(null);
  const [feed, setFeed] = useState<AdminActivityItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [result, deviceList, weekCounts, activity] = await Promise.all([
        fetchAdminSummaryMetrics(),
        fetchAdminSmartwatchDevices("").catch(() => [] as AdminSmartwatchDevice[]),
        fetchAdminWeek().catch(() => null),
        fetchAdminActivityFeed(10).catch(() => null),
      ]);
      setMetrics(result);
      setDevices(deviceList);
      setWeek(weekCounts);
      setFeed(activity);
      setLastUpdated(new Date().toISOString());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return subscribeAdminUpdates(() => void load());
  }, [load]);

  // Keep "x min ago" labels honest between updates.
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const linked = useMemo(() => devices.filter((device) => device.isActive && device.childId), [devices]);
  const linkedCount = devices.length ? linked.length : metrics?.activeDevices ?? null;
  const registeredCount = devices.length || metrics?.activeDevices || 0;
  const recordsToday = week ? week[week.length - 1]?.locations ?? 0 : null;
  const spotlight = useMemo(
    () =>
      [...linked].sort((a, b) => (Date.parse(b.latestLocationAt ?? "") || 0) - (Date.parse(a.latestLocationAt ?? "") || 0))[0] ??
      devices[0] ??
      null,
    [linked, devices],
  );

  if (error && !metrics) {
    return (
      <View style={styles.center}>
        <View style={[styles.errorCard, { borderColor: colors.rule }]}>
          <View style={[styles.errorIcon, { backgroundColor: colors.dangerTint }]}>
            <Ionicons name="cloud-offline-outline" size={26} color={colors.danger} />
          </View>
          <Text variant="heading" weight="800">
            The dashboard couldn&apos;t load
          </Text>
          <Text tone="muted" align="center">
            {error} Check the internet connection, then try again.
          </Text>
          <Button label="Try again" icon="refresh" onPress={() => void load()} />
        </View>
      </View>
    );
  }

  const activeSos = metrics?.activeSosAlerts ?? null;
  const status =
    activeSos === null
      ? "Checking the latest records…"
      : activeSos > 0
        ? `${activeSos} active SOS ${activeSos === 1 ? "needs" : "need"} acknowledgement`
        : `All quiet — no active SOS · ${linkedCount ?? 0} of ${registeredCount} watches linked`;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />}
    >
      {/* Hero. */}
      <Rise index={0}>
        <LinearGradient colors={["#0D2A1E", "#123A28", "#16603A"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <MapPattern opacity={0.06} />
          <View style={styles.heroGlow} />
          <View style={styles.heroCopy}>
            <Text variant="legend" style={styles.heroKicker}>
              {todayLabel()} · PHILIPPINE TIME
            </Text>
            <Text variant="display" style={styles.heroTitle} accessibilityRole="header">
              {greeting()}
              {/* A real first name only; not the generic "SafeTrack Administrator". */}
              {adminName && !/safetrack|admin/i.test(adminName) ? `, ${adminName.split(" ")[0]}` : ""}.
            </Text>
            <View style={styles.statusRow}>
              <LivePulse color={activeSos ? "#FF6B5C" : "#3DDC84"} />
              <Text weight="700" style={[styles.statusText, activeSos ? { color: "#FFB4AB" } : null]}>
                {status}
              </Text>
            </View>
            <Text variant="caption" style={styles.heroUpdated}>
              {lastUpdated ? `Updated ${timeAgo(lastUpdated)} · refreshes when records change` : "Loading…"}
            </Text>
          </View>
          <View style={styles.heroActions}>
            <Button label="Refresh" variant="glass" size="sm" icon="refresh" loading={refreshing} onPress={() => void refresh()} />
            <Button label="Export report" variant="secondary" size="sm" icon="download-outline" onPress={() => router.push("/(app)/admin-reports")} />
          </View>
        </LinearGradient>
      </Rise>

      {/* Figures. */}
      <View style={[styles.figures, width < 1100 && styles.figuresStacked]}>
        <Rise index={1} style={[styles.figureCell, tablet && { flex: 1.35 }]}>
          <SosFigure value={activeSos} onPress={() => router.push("/(app)/admin-records")} />
        </Rise>
        <Rise index={2} style={styles.figureCell}>
          <Figure
            icon="watch-outline"
            label="Linked devices"
            value={loading ? null : linkedCount}
            detail={loading ? " " : `linked · ${formatNumber(registeredCount)} registered`}
            meter={registeredCount ? (linkedCount ?? 0) / registeredCount : 0}
            onPress={() => router.push("/(app)/admin-devices")}
          />
        </Rise>
        <Rise index={3} style={styles.figureCell}>
          <Figure icon="people-outline" label="Guardians" value={metrics?.guardianAccounts ?? null} detail="guardian accounts" onPress={() => router.push("/(app)/admin-guardians")} />
        </Rise>
        <Rise index={4} style={styles.figureCell}>
          <Figure icon="happy-outline" label="Children" value={metrics?.registeredChildren ?? null} detail="registered children" onPress={() => router.push("/(app)/admin-guardians")} />
        </Rise>
        <Rise index={5} style={styles.figureCell}>
          <Figure
            icon="location-outline"
            label="Records today"
            value={recordsToday}
            detail="location records"
            spark={week?.map((day) => day.locations)}
            onPress={() => router.push("/(app)/admin-records")}
          />
        </Rise>
      </View>

      <View style={[styles.grid, wide && styles.gridWide]}>
        <View style={styles.main}>
          <Rise index={6}>
            <WeekChart week={week} />
          </Rise>
          <Rise index={7}>
            <ActivityFeed items={feed} onOpenAll={() => router.push("/(app)/admin-records")} />
          </Rise>
        </View>

        <View style={[styles.rail, wide && styles.railWide]}>
          <Rise index={6}>
            <Spotlight
              device={spotlight}
              loading={loading}
              onOpen={(id) => router.push({ pathname: "/(app)/admin-device-details", params: { deviceId: id } })}
              onAll={() => router.push("/(app)/admin-devices")}
            />
          </Rise>
          <Rise index={7}>
            <View style={styles.totals}>
              <Text variant="legend" style={styles.totalsKicker}>
                Stored in SafeTrack
              </Text>
              <TotalRow icon="navigate-outline" label="Location records" value={metrics?.locationRecords ?? null} />
              <TotalRow icon="shield-checkmark-outline" label="Active safe zones" value={metrics?.activeSafeZones ?? null} />
              <TotalRow icon="document-text-outline" label="Reports generated" value={metrics?.generatedReports ?? null} />
              <Text variant="caption" style={styles.totalsNote}>
                Each location is the latest position a device sent, not a live feed.
              </Text>
              <View style={styles.links}>
                <QuickLink icon="list-outline" label="Records" onPress={() => router.push("/(app)/admin-records")} />
                <QuickLink icon="document-text-outline" label="Reports" onPress={() => router.push("/(app)/admin-reports")} />
              </View>
            </View>
          </Rise>
        </View>
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------

function SosFigure({ value, onPress }: { value: number | null; onPress: () => void }) {
  const styles = useStyles();
  const { colors, reduceMotion } = useTheme();
  const glow = useRef(new Animated.Value(0)).current;
  const alarm = (value ?? 0) > 0;
  const { value: flash, flash: trigger } = useFlash();

  useEffect(() => {
    if (!alarm || reduceMotion) {
      glow.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [alarm, glow, reduceMotion]);

  return (
    <Lift onPress={onPress} accessibilityLabel={`Active SOS: ${value ?? "loading"}. Open records`} style={styles.liftFill}>
      <Animated.View
        style={[
          styles.figure,
          styles.sosFigure,
          alarm
            ? {
                backgroundColor: colors.dangerTint,
                borderColor: colors.danger,
                shadowColor: colors.danger,
                shadowOpacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.35] }) as unknown as number,
                shadowRadius: 22,
                shadowOffset: { width: 0, height: 0 },
              }
            : { borderColor: flash.interpolate({ inputRange: [0, 1], outputRange: [colors.rule, colors.brand] }) as unknown as string },
        ]}
      >
        <View style={styles.figureTop}>
          <Text variant="legend" style={{ color: alarm ? colors.danger : colors.muted }}>
            Active SOS
          </Text>
          <View style={[styles.figureIcon, { backgroundColor: alarm ? colors.danger : colors.primaryTint }]}>
            <Ionicons name={alarm ? "alert" : "shield-checkmark"} size={18} color={alarm ? "#FFFFFF" : colors.primary} />
          </View>
        </View>
        <CountUp value={value} onChange={trigger} style={[styles.figureValue, alarm && { color: colors.danger }]} />
        <Text variant="label" style={{ color: alarm ? colors.danger : colors.muted }} weight={alarm ? "800" : "500"}>
          {value === null ? " " : alarm ? "Needs acknowledgement · open records" : "None right now"}
        </Text>
      </Animated.View>
    </Lift>
  );
}

function Figure({
  icon,
  label,
  value,
  detail,
  meter,
  spark,
  onPress,
}: {
  icon: IconName;
  label: string;
  value: number | null;
  detail: string;
  meter?: number;
  spark?: number[];
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { value: flash, flash: trigger } = useFlash();
  const max = spark ? Math.max(1, ...spark) : 1;

  return (
    <Lift onPress={onPress} accessibilityLabel={`${label}: ${value ?? "loading"} ${detail}`} style={styles.liftFill}>
      <Animated.View style={[styles.figure, { borderColor: flash.interpolate({ inputRange: [0, 1], outputRange: [colors.rule, colors.brand] }) as unknown as string }]}>
        <View style={styles.figureTop}>
          <Text variant="legend" tone="muted">
            {label}
          </Text>
          <Ionicons name={icon} size={18} color={colors.primary} />
        </View>
        <CountUp value={value} onChange={trigger} style={styles.figureValue} />
        <Text variant="label" tone="muted" numberOfLines={1}>
          {detail}
        </Text>
        {meter !== undefined ? (
          <View style={[styles.meter, { backgroundColor: colors.sunken }]}>
            <View style={[styles.meterFill, { width: `${Math.round(Math.min(1, meter) * 100)}%`, backgroundColor: colors.brand }]} />
          </View>
        ) : null}
        {spark ? (
          <View style={styles.spark} accessibilityLabel={`Last 7 days: ${spark.join(", ")}`}>
            {spark.map((n, index) => (
              <View
                key={index}
                style={[
                  styles.sparkBar,
                  { height: `${Math.max(8, (n / max) * 100)}%`, backgroundColor: index === spark.length - 1 ? colors.primary : colors.ruleStrong },
                ]}
              />
            ))}
          </View>
        ) : null}
      </Animated.View>
    </Lift>
  );
}

// ---------------------------------------------------------------------------

const DAY = new Intl.DateTimeFormat("en-PH", { weekday: "short", timeZone: "UTC" });
const DATE = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" });

/** Location records per Philippine day (bars) with SOS markers (dots). Bars grow in turn. */
function WeekChart({ week }: { week: AdminDayCount[] | null }) {
  const styles = useStyles();
  const { colors, reduceMotion, scheme } = useTheme();
  const grow = useRef(Array.from({ length: 7 }, () => new Animated.Value(reduceMotion ? 1 : 0))).current;
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (!week || reduceMotion) return;
    Animated.stagger(
      30,
      grow.map((value) => Animated.timing(value, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver })),
    ).start();
  }, [week, grow, reduceMotion]);

  const max = week ? Math.max(1, ...week.map((day) => day.locations)) : 1;
  const total = week?.reduce((sum, day) => sum + day.locations, 0) ?? 0;
  const sos = week?.reduce((sum, day) => sum + day.sos, 0) ?? 0;
  const shown = hover !== null && week ? week[hover] : null;

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.flex}>
          <Text variant="heading" weight="800">
            Last 7 days
          </Text>
          <Text variant="caption" tone="muted">
            Location records per day · red dots mark days with SOS alerts · Philippine time
          </Text>
        </View>
        <View style={styles.chartTotals}>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: colors.primary }]} />
            <Text variant="label" weight="800" tabular>
              {week ? formatNumber(total) : "–"}
            </Text>
            <Text variant="caption" tone="muted">
              records
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.danger }]} />
            <Text variant="label" weight="800" tabular>
              {week ? formatNumber(sos) : "–"}
            </Text>
            <Text variant="caption" tone="muted">
              SOS
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.chart}>
        {(week ?? Array.from({ length: 7 }, () => null)).map((day, index) => {
          const share = day ? day.locations / max : 0;
          const today = index === 6;
          const active = hover === index;
          return (
            <Pressable
              key={index}
              accessibilityLabel={day ? `${day.day}: ${day.locations} records, ${day.sos} SOS, ${day.events} safety events` : "Loading"}
              onHoverIn={() => setHover(index)}
              onHoverOut={() => setHover((value) => (value === index ? null : value))}
              onPress={() => setHover((value) => (value === index ? null : index))}
              style={styles.chartCol}
            >
              <View style={styles.chartTrack}>
                {day && day.sos > 0 ? (
                  <View style={[styles.sosDot, { bottom: `${Math.max(6, share * 100)}%`, backgroundColor: colors.danger, borderColor: colors.surface }]} />
                ) : null}
                {day ? (
                  <Animated.View
                    style={[
                      styles.chartBar,
                      {
                        height: `${Math.max(3, share * 100)}%`,
                        backgroundColor: today ? colors.primary : active ? colors.brand : scheme === "dark" ? colors.forestRaised : "#CFE6D8",
                        transform: [{ scaleY: grow[index] }],
                      },
                    ]}
                  />
                ) : (
                  <Skeleton width="100%" height={60 + index * 12} radius={10} />
                )}
              </View>
              <Text variant="caption" weight={today ? "800" : "600"} tone={today ? "primary" : "muted"}>
                {day ? (today ? "Today" : DAY.format(new Date(`${day.day}T00:00:00Z`))) : " "}
              </Text>
            </Pressable>
          );
        })}

        {shown ? (
          <View
            pointerEvents="none"
            style={[
              styles.tooltip,
              // Near the right edge the tooltip opens to the left of the bar.
              hover! >= 4 ? { right: `${((6 - hover!) / 7) * 100}%` } : { left: `${(hover! / 7) * 100}%` },
              { backgroundColor: colors.forest },
            ]}
          >
            <Text variant="caption" weight="800" style={styles.tooltipTitle}>
              {DATE.format(new Date(`${shown.day}T00:00:00Z`))}
            </Text>
            <Text variant="caption" style={styles.tooltipText}>
              {formatNumber(shown.locations)} records · {shown.sos} SOS · {shown.events} events
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

function ActivityFeed({ items, onOpenAll }: { items: AdminActivityItem[] | null; onOpenAll: () => void }) {
  const styles = useStyles();
  const seen = useRef<Set<string> | null>(null);
  const fresh = useMemo(() => {
    if (!items) return new Set<string>();
    const previous = seen.current;
    seen.current = new Set(items.map((item) => item.id));
    return previous ? new Set(items.filter((item) => !previous.has(item.id)).map((item) => item.id)) : new Set<string>();
  }, [items]);

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.flex}>
          <View style={styles.titleRow}>
            <Text variant="heading" weight="800">
              Live activity
            </Text>
            <LivePulse size={7} />
          </View>
          <Text variant="caption" tone="muted">
            Newest SOS alerts and safety events across all children
          </Text>
        </View>
        <Button label="All records" variant="soft" size="sm" iconRight="arrow-forward" onPress={onOpenAll} />
      </View>

      {items === null ? (
        <View style={{ gap: 14 }}>
          {[0, 1, 2, 3].map((index) => (
            <View key={index} style={styles.feedRow}>
              <Skeleton width={38} height={38} radius={12} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width="45%" height={12} />
                <Skeleton width="75%" height={10} />
              </View>
            </View>
          ))}
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="leaf-outline" size={26} color="#3DDC84" />
          <Text weight="700">Nothing yet</Text>
          <Text variant="caption" tone="muted" align="center">
            SOS alerts and safe-zone events will appear here as they happen.
          </Text>
        </View>
      ) : (
        <View>
          {items.map((item, index) => (
            <FeedRow key={item.id} item={item} last={index === items.length - 1} fresh={fresh.has(item.id)} />
          ))}
        </View>
      )}
    </View>
  );
}

const FEED_LABELS: Record<string, string> = {
  active: "Active",
  acknowledged: "Acknowledged",
  cancelled: "Cancelled",
  entry: "Entered zone",
  exit: "Left zone",
  possible_anomaly: "AI notice",
  watch_disconnected: "Watch offline",
  prolonged_inactivity: "Inactivity",
};

function FeedRow({ item, last, fresh }: { item: AdminActivityItem; last: boolean; fresh: boolean }) {
  const styles = useStyles();
  const { colors, reduceMotion } = useTheme();
  const tone = toneFor(item.type);
  const t = useTone(tone);
  const highlight = useRef(new Animated.Value(fresh && !reduceMotion ? 1 : 0)).current;
  const enter = useRef(new Animated.Value(fresh && !reduceMotion ? 0 : 1)).current;

  useEffect(() => {
    if (!fresh || reduceMotion) return;
    Animated.parallel([
      Animated.timing(enter, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(highlight, { toValue: 0, duration: 1000, delay: 300, useNativeDriver: false }),
    ]).start();
  }, [fresh, enter, highlight, reduceMotion]);

  return (
    <Animated.View
      style={[
        styles.feedRow,
        !last && { borderBottomWidth: 1, borderBottomColor: colors.rule },
        {
          backgroundColor: highlight.interpolate({ inputRange: [0, 1], outputRange: ["rgba(61,220,132,0)", "rgba(61,220,132,0.16)"] }) as unknown as string,
          opacity: enter,
          transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
        },
      ]}
    >
      <View style={[styles.feedIcon, { backgroundColor: t.bg }]}>
        <Ionicons name={item.kind === "sos" ? "warning" : t.icon} size={18} color={item.kind === "sos" && item.type === "active" ? colors.danger : t.fg} />
      </View>
      <View style={styles.flex}>
        <View style={styles.feedTop}>
          <Text weight="800" numberOfLines={1} style={styles.flexShrink}>
            {item.title}
          </Text>
          <TonePill tone={tone} label={FEED_LABELS[item.type] ?? item.type.replaceAll("_", " ")} icon={false} />
        </View>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          <Text variant="caption" weight="800" tone="ink2">
            {item.childName}
          </Text>
          {item.detail ? ` · ${item.detail}` : ""}
        </Text>
      </View>
      <View style={styles.feedTime}>
        <Text variant="caption" weight="700" tone="ink2" tabular>
          {timeAgo(item.occurredAt)}
        </Text>
        <Text variant="caption" tone="muted" tabular>
          {phTime(item.occurredAt)}
        </Text>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------

function Spotlight({
  device,
  loading,
  onOpen,
  onAll,
}: {
  device: AdminSmartwatchDevice | null;
  loading: boolean;
  onOpen: (id: string) => void;
  onAll: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const level = freshness(device?.latestLocationAt);
  const levelColor = level === "fresh" ? colors.brand : level === "recent" ? "#E0A43A" : colors.offline;

  return (
    <View style={styles.spotlight}>
      <View style={styles.spotlightHead}>
        <Text variant="legend" tone="primary">
          Device spotlight
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="All devices" onPress={onAll} hitSlop={8}>
          <Text variant="caption" weight="800" tone="primary">
            All devices
          </Text>
        </Pressable>
      </View>
      {loading ? (
        <View style={{ gap: 10, alignItems: "center" }}>
          <Skeleton width={150} height={150} radius={75} />
          <Skeleton width="70%" height={14} />
        </View>
      ) : device ? (
        <>
          <View style={styles.watchStage}>
            <View style={[styles.watchHalo, { backgroundColor: colors.surface }]} />
            <WatchIllustration size={150} />
          </View>
          <View>
            <Text variant="heading" weight="800" numberOfLines={1}>
              {device.childId ? device.childName : "Not linked"}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {device.watchId}
              {device.childId ? ` · Guardian ${device.guardianName}` : ""}
            </Text>
          </View>
          <View style={styles.spotChips}>
            <View style={[styles.spotChip, { backgroundColor: colors.surface }]}>
              <View style={[styles.freshDot, { backgroundColor: levelColor }]} />
              <View style={styles.flex}>
                <Text variant="label" weight="800" tabular numberOfLines={1}>
                  {timeAgo(device.latestLocationAt, "No location yet")}
                </Text>
                <Text variant="caption" tone="muted">
                  Latest location
                </Text>
              </View>
            </View>
            <View style={[styles.spotChip, { backgroundColor: colors.surface }]}>
              <TonePill tone={device.isActive ? "ok" : "off"} label={device.isActive ? "Active" : "Turned off"} />
            </View>
          </View>
          <Button label="Open device" size="sm" iconRight="arrow-forward" onPress={() => onOpen(device.deviceId)} />
        </>
      ) : (
        <View style={styles.emptyState}>
          <WatchIllustration size={120} />
          <Text variant="caption" tone="muted" align="center">
            No smartwatch is registered yet. Paired watches appear here.
          </Text>
        </View>
      )}
    </View>
  );
}

function TotalRow({ icon, label, value }: { icon: IconName; label: string; value: number | null }) {
  const styles = useStyles();
  return (
    <View style={styles.totalRow}>
      <Ionicons name={icon} size={16} color="#3DDC84" />
      <Text variant="label" style={styles.totalLabel}>
        {label}
      </Text>
      <CountUp value={value} variant="heading" style={styles.totalValue} />
    </View>
  );
}

function QuickLink({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Lift onPress={onPress} accessibilityLabel={label} style={styles.quickLink} hoverStyle={styles.quickLinkHover}>
      <Ionicons name={icon} size={16} color="#3DDC84" />
      <Text variant="label" weight="700" style={styles.white}>
        {label}
      </Text>
      <Ionicons name="arrow-forward" size={14} color="#9FC3AE" style={{ marginLeft: "auto" }} />
    </Lift>
  );
}

const useStyles = makeStyles((c, scheme) => {
  const dark = scheme === "dark";
  const card = { backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.rule };
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.paper },
    content: { width: "100%", maxWidth: 1360, alignSelf: "center", padding: space.lg, paddingTop: space.xl, paddingBottom: 120, gap: space.lg },
    flex: { flex: 1, minWidth: 0 },
    flexShrink: { flexShrink: 1 },
    white: { color: "#FFFFFF" },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl, backgroundColor: c.paper },
    errorCard: { ...card, width: "100%", maxWidth: 440, padding: 28, gap: 12, alignItems: "center" },
    errorIcon: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center" },

    hero: { borderRadius: 28, overflow: "hidden", paddingHorizontal: 32, paddingVertical: 30, flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", gap: 20 },
    heroGlow: { position: "absolute", width: 420, height: 420, borderRadius: 210, right: -120, top: -220, backgroundColor: "rgba(61,220,132,0.12)" },
    heroCopy: { flex: 1, minWidth: 280, gap: 6 },
    heroKicker: { color: "#3DDC84" },
    heroTitle: { color: "#FFFFFF", fontSize: 36, lineHeight: 42 },
    statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginLeft: -4, marginTop: 4 },
    statusText: { color: "#E3F2E9", fontSize: 15.5 },
    heroUpdated: { color: "#9FC3AE" },
    heroActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },

    figures: { flexDirection: "row", gap: space.md },
    figuresStacked: { flexWrap: "wrap" },
    figureCell: { flex: 1, minWidth: 190 },
    liftFill: { flex: 1, borderRadius: radius.md },
    figure: { ...card, flex: 1, padding: 18, gap: 4, minHeight: 148 },
    sosFigure: { borderWidth: 1.5 },
    figureTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
    figureIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    figureValue: { fontSize: 38, lineHeight: 44 },
    meter: { height: 6, borderRadius: 3, overflow: "hidden", marginTop: 8 },
    meterFill: { height: 6, borderRadius: 3 },
    spark: { flexDirection: "row", alignItems: "flex-end", gap: 3, height: 22, marginTop: 8 },
    sparkBar: { flex: 1, borderRadius: 2 },

    grid: { gap: space.lg },
    gridWide: { flexDirection: "row", alignItems: "flex-start" },
    main: { flex: 1, minWidth: 0, gap: space.lg },
    rail: { gap: space.lg },
    railWide: { width: 360 },

    card: { ...card, padding: 22, gap: 18 },
    cardHead: { flexDirection: "row", alignItems: "flex-start", gap: 12, flexWrap: "wrap" },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 2 },
    chartTotals: { flexDirection: "row", gap: 16 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    legendSwatch: { width: 10, height: 10, borderRadius: 3 },
    legendDot: { width: 9, height: 9, borderRadius: 5 },
    chart: { flexDirection: "row", gap: 12, height: 230 },
    chartCol: { flex: 1, alignItems: "center", gap: 8 },
    chartTrack: { flex: 1, width: "100%", maxWidth: 72, justifyContent: "flex-end", borderRadius: 12, backgroundColor: c.sunken, overflow: "visible" },
    chartBar: { width: "100%", borderRadius: 12, transformOrigin: "bottom" },
    sosDot: { position: "absolute", alignSelf: "center", width: 14, height: 14, borderRadius: 7, borderWidth: 3, marginBottom: 6, zIndex: 2 },
    tooltip: { position: "absolute", top: -6, marginLeft: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, gap: 2 },
    tooltipTitle: { color: "#3DDC84" },
    tooltipText: { color: "#FFFFFF" },

    feedRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 6, borderRadius: 10 },
    feedIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    feedTop: { flexDirection: "row", alignItems: "center", gap: 8 },
    feedTime: { alignItems: "flex-end", gap: 1 },
    emptyState: { alignItems: "center", gap: 6, paddingVertical: 24 },

    spotlight: { borderRadius: radius.md, padding: 22, gap: 14, backgroundColor: dark ? c.primaryTint : "#E1F2E7" },
    spotlightHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    watchStage: { alignItems: "center", justifyContent: "center", paddingVertical: 4 },
    watchHalo: { position: "absolute", width: 170, height: 170, borderRadius: 85, opacity: 0.7 },
    spotChips: { flexDirection: "row", gap: 8 },
    spotChip: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 14 },
    freshDot: { width: 10, height: 10, borderRadius: 5 },

    totals: { borderRadius: radius.md, padding: 22, gap: 12, backgroundColor: dark ? c.forest : "#0D2A1E" },
    totalsKicker: { color: "#9FC3AE" },
    totalRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    totalLabel: { flex: 1, color: "#E3F2E9" },
    totalValue: { color: "#FFFFFF" },
    totalsNote: { color: "#9FC3AE", marginTop: 2 },
    links: { gap: 6, marginTop: 4 },
    quickLink: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 42, paddingHorizontal: 14, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.06)" },
    quickLinkHover: { backgroundColor: "rgba(255,255,255,0.12)" },
  });
});
