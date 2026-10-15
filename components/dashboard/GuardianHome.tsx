import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { Animated, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthStore } from "../../store/authStore";
import { useLocationStore } from "../../store/locationStore";
import { useSosStore } from "../../store/sosStore";
import { useGeofenceStore } from "../../store/geofenceStore";
import { useAnomalyStore } from "../../store/anomalyStore";
import { fetchSmartwatchForChild, type SmartwatchStatus } from "../../services/smartwatchService";
import { LocationMapCard } from "../location/LocationMapCard";
import { MapAwareScrollView } from "../location/MapScrollLock";
import { childRing, toZoneCircles } from "../location/zoneCircles";
import { freshness } from "../location/mapTypes";
import { Button } from "../ui/Button";
import { Entrance } from "../ui/Entrance";
import { StatusScrim } from "../ui/StatusScrim";
import { MapPattern } from "../ui/MapPattern";
import { StateRing } from "../ui/StateRing";
import { Text } from "../ui/Text";
import { usePressFeedback, usePulse } from "../../theme/motion";
import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { radius, shadow, space, type ChildState } from "../../theme/tokens";

function minutesAgo(value?: string | null) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
}

/** "2 min ago", "3 hrs ago": always the age of the latest location. */
function ago(value?: string | null) {
  const minutes = minutesAgo(value);
  if (minutes === null) return null;
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function firstName(value?: string | null) {
  return value?.trim().split(/\s+/)[0] || "Guardian";
}

function initials(value?: string | null) {
  const words = value?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (words.length === 0) return "ST";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning," : hour < 18 ? "Good afternoon," : "Good evening,";
}

export function GuardianHome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 1040;
  const { colors, scheme } = useTheme();
  const styles = useStyles();

  const guardian = useAuthStore((state) => state.guardian);
  const child = useAuthStore((state) => state.linkedChildren?.[0] ?? null);

  const latestLocation = useLocationStore((state) => state.latest);
  const locationHistory = useLocationStore((state) => state.history);
  const locationLoading = useLocationStore((state) => state.isLoading);
  const loadLocation = useLocationStore((state) => state.loadForChild);

  const sosAlerts = useSosStore((state) => state.alerts);
  const loadSos = useSosStore((state) => state.loadForChild);

  const zones = useGeofenceStore((state) => state.zones);
  const zoneEvents = useGeofenceStore((state) => state.events);
  const loadZones = useGeofenceStore((state) => state.load);

  const storedAnomaly = useAnomalyStore((state) => state.latestAnomaly);
  // Only a recent AI notice needs the guardian's attention on Home; older
  // ones stay in Activity History.
  const latestAnomaly =
    storedAnomaly && Date.now() - Date.parse(storedAnomaly.occurredAt) < 24 * 60 * 60 * 1000 ? storedAnomaly : null;
  const loadAnomaly = useAnomalyStore((state) => state.loadForChild);

  const [watch, setWatch] = useState<SmartwatchStatus | null>(null);

  const trackingSource = child?.trackingSource ?? "mobile";
  const hasWatch = trackingSource === "smartwatch" || trackingSource === "both";

  useEffect(() => {
    if (!child) return;

    void loadLocation(child.id, child.fullName);
    void loadSos(child.id, child.fullName);
    void loadZones(child.guardianId, child.id);
    void loadAnomaly(child.id);

    if (hasWatch) {
      fetchSmartwatchForChild(child.id)
        .then(setWatch)
        .catch(() => setWatch(null));
    } else {
      setWatch(null);
    }
  }, [child?.id, hasWatch]);

  const zoneCircles = useMemo(() => toZoneCircles(zones, zoneEvents), [zones, zoneEvents]);

  const activeSOS = useMemo(() => sosAlerts.find((item) => item.status === "active"), [sosAlerts]);

  // The same rule as the map marker: SOS, then stale, then the server's
  // latest zone entry/exit.
  const ring = childRing(zoneCircles, { sosActive: Boolean(activeSOS), freshness: freshness(latestLocation?.recordedAt) });
  const state: ChildState =
    ring === "sos" ? "sos" : ring === "stale" ? "offline" : ring === "inside" ? "inside" : ring === "outside" ? "outside" : "unknown";
  const insideZone = zoneCircles.find((circle) => circle.status === "inside");
  const age = ago(latestLocation?.recordedAt);

  const statusLine = !child
    ? "Register a child to begin"
    : activeSOS
      ? "SOS needs attention"
      : !latestLocation || !age
        ? "Waiting for the first location"
        : state === "offline"
          ? `Last seen ${age}`
          : state === "inside"
            ? `Safe at ${insideZone?.label ?? "a safe zone"} · ${age}`
            : state === "outside"
              ? `Outside safe zones · ${age}`
              : `Updated ${age}`;

  const statusTone = state === "sos" ? "danger" : state === "outside" ? "warning" : state === "offline" ? "muted" : "primary";
  const dotColor =
    state === "sos" ? colors.danger : state === "outside" ? colors.warningFill : state === "offline" ? colors.offline : colors.brand;
  const deviceLine = !child
    ? null
    : !hasWatch
      ? "Location from the child's phone"
      : watch?.connectionStatus === "connected"
        ? "Watch connected"
        : "Watch not recently connected";

  return (
    <View style={styles.root}>
    <MapAwareScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      {activeSOS ? <SosBand childName={child?.fullName ?? "Your child"} onOpen={() => router.push("/(app)/sos-alerts")} /> : null}

      <SafeAreaView edges={activeSOS ? [] : ["top"]} style={styles.header}>
        <MapPattern opacity={0.08} />
        <View style={styles.headerRow}>
          <View style={styles.guardianRow}>
            <View style={styles.guardianAvatar}>
              <Text variant="label" tone="primary" weight="800" style={styles.guardianInitials}>
                {initials(guardian?.fullName)}
              </Text>
            </View>
            <View>
              <Text variant="label" weight="500" style={styles.headerSoft}>
                {greeting()}
              </Text>
              <Text variant="heading" weight="800" style={styles.headerName}>
                {firstName(guardian?.fullName)}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={activeSOS || latestAnomaly ? "Open notifications, new alerts" : "Open notifications"}
            onPress={() => router.push("/(app)/notifications")}
            style={({ pressed }) => [styles.bell, pressed && styles.pressed]}
          >
            <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
            {activeSOS || latestAnomaly ? <View style={[styles.bellDot, { backgroundColor: activeSOS ? "#FF6B5C" : "#3DDC84" }]} /> : null}
          </Pressable>
        </View>
      </SafeAreaView>

      <View style={styles.body}>
        <Entrance index={0} style={styles.childCard}>
          {child ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${child.fullName}. ${statusLine}. Edit child profile`}
                onPress={() => router.push({ pathname: "/(app)/edit-child-profile", params: { childId: child.id, section: "details" } })}
                style={styles.childRow}
              >
                <StateRing
                  name={child.fullName}
                  photoUrl={child.avatarUrl}
                  state={state}
                  size={60}
                  live={state === "inside" || state === "outside"}
                />
                <View style={styles.childCopy}>
                  <Text variant="heading" weight="800" numberOfLines={1}>
                    {child.fullName}
                  </Text>
                  <View style={styles.statusRow}>
                    <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
                    <Text variant="label" tone={statusTone} weight="600" numberOfLines={1} style={styles.flex}>
                      {statusLine}
                    </Text>
                  </View>
                </View>
                {watch?.batteryPercent != null ? (
                  <View style={styles.battery}>
                    <Text variant="heading" weight="800" tabular>
                      {watch.batteryPercent}%
                    </Text>
                    <Text variant="legend">Watch</Text>
                  </View>
                ) : (
                  <Ionicons name="chevron-forward" size={20} color={colors.muted} />
                )}
              </Pressable>

              <View style={styles.stats}>
                <Stat label="Safe zones" value={String(zones.length)} onPress={() => router.push("/(app)/safe-zones")} />
                <View style={styles.statRule} />
                <Stat
                  label="SOS"
                  value={activeSOS ? "Active" : "Clear"}
                  tone={activeSOS ? "danger" : "ink"}
                  onPress={() => router.push("/(app)/sos-alerts")}
                />
                <View style={styles.statRule} />
                <Stat
                  label="AI notice"
                  value={latestAnomaly ? "Review" : "None"}
                  tone={latestAnomaly ? "warning" : "ink"}
                  onPress={() => router.push("/(app)/anomaly-details")}
                />
              </View>
            </>
          ) : (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="person-add-outline" size={26} color={colors.primary} />
              </View>
              <Text variant="heading">Register your child</Text>
              <Text variant="body" align="center">
                Add your child and link their SafeTrack watch or phone to see their latest location here.
              </Text>
              <Button label="Register your child" icon="person-add-outline" onPress={() => router.push("/(auth)/child-registration")} block />
            </View>
          )}
        </Entrance>

        {child ? (
          <>
            <Entrance index={1} style={styles.sectionHeader}>
              <View style={styles.flex}>
                <Text variant="heading" weight="800">
                  Latest location
                </Text>
                <Text variant="caption">
                  {latestLocation && age
                    ? `Updated ${age} · from ${latestLocation.source === "smartwatch" ? "watch" : "phone"} · not real-time`
                    : "Waiting for the child's device to send a location"}
                </Text>
              </View>
              <Pressable accessibilityRole="link" onPress={() => router.push("/(app)/location")} hitSlop={8} style={styles.linkRow}>
                <Text variant="label" tone="primary" weight="800">
                  Open map
                </Text>
                <Ionicons name="arrow-forward" size={15} color={colors.primary} />
              </Pressable>
            </Entrance>

            <Entrance index={2}>
              <LocationMapCard
                location={latestLocation}
                loading={locationLoading}
                trackingSource={trackingSource === "mobile" || trackingSource === "both" ? trackingSource : "smartwatch"}
                height={wide ? 460 : 330}
                onRefresh={() => child && loadLocation(child.id, child.fullName)}
                zones={zoneCircles}
                avatarPath={child?.avatarPath}
                avatarUrl={child?.avatarUrl}
                sosActive={Boolean(activeSOS)}
                batteryPercent={watch?.batteryPercent ?? null}
                networkType={watch?.networkType ?? null}
              />
            </Entrance>

            <Entrance index={3} style={styles.tiles}>
              <Tile icon="radio-button-on-outline" label="Safe zones" onPress={() => router.push("/(app)/safe-zones")} />
              <Tile icon="time-outline" label="Activity" detail={`${locationHistory.length} records`} onPress={() => router.push("/(app)/history")} />
              <Tile
                icon="key-outline"
                label="Connect"
                onPress={() => router.push({ pathname: "/(app)/device-connection-code", params: { childId: child.id, section: "details" } })}
              />
              <Tile icon="notifications-outline" label="Notices" strong onPress={() => router.push("/(app)/notifications")} />
            </Entrance>

            {deviceLine ? (
              <Entrance index={4} style={styles.deviceLine}>
                <Ionicons name={hasWatch ? "watch-outline" : "phone-portrait-outline"} size={15} color={colors.muted} />
                <Text variant="caption">{deviceLine}</Text>
              </Entrance>
            ) : null}
          </>
        ) : null}
      </View>
    </MapAwareScrollView>
    <StatusScrim color={activeSOS ? colors.danger : scheme === "dark" ? colors.forest : "#15803D"} />
    </View>
  );
}

/** Full-width red band at the very top while an SOS is active. */
function SosBand({ childName, onOpen }: { childName: string; onOpen: () => void }) {
  const styles = useStyles();
  const pulse = usePulse(true, 1400);

  return (
    <SafeAreaView edges={["top"]} style={styles.sosBand}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`SOS active. ${childName} needs help. Open SOS alerts`}
        onPress={onOpen}
        style={styles.sosRow}
      >
        <View style={styles.sosIconWrap}>
          <Animated.View
            style={[
              styles.sosHalo,
              {
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }],
              },
            ]}
          />
          <Ionicons name="alert" size={20} color="#B42318" />
        </View>
        <View style={styles.flex}>
          <Text variant="legend" style={styles.sosEyebrow}>
            SOS · Active
          </Text>
          <Text variant="body" weight="800" style={styles.white} numberOfLines={1}>
            {childName} needs help
          </Text>
        </View>
        <View style={styles.sosOpen}>
          <Text variant="label" weight="800" style={styles.sosOpenText}>
            Open
          </Text>
        </View>
      </Pressable>
    </SafeAreaView>
  );
}

function Stat({
  label,
  value,
  tone = "ink",
  onPress,
}: {
  label: string;
  value: string;
  tone?: "ink" | "danger" | "warning";
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={({ pressed }) => [styles.stat, pressed && styles.pressed]}
    >
      <Text variant="heading" weight="800" tone={tone} tabular numberOfLines={1} style={styles.statValue}>
        {value}
      </Text>
      <Text variant="legend">{label}</Text>
    </Pressable>
  );
}

function Tile({
  icon,
  label,
  detail,
  strong,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  detail?: string;
  strong?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const press = usePressFeedback();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={styles.tileCell}
    >
      <Animated.View style={[styles.tile, press.style]}>
        <View style={[styles.tileIcon, strong && { backgroundColor: colors.forest }]}>
          <Ionicons name={icon} size={20} color={strong ? "#3DDC84" : colors.primary} />
        </View>
        <Text variant="caption" tone="ink" weight="700" numberOfLines={1}>
          {label}
        </Text>
        {detail ? (
          <Text variant="caption" numberOfLines={1} style={styles.tileDetail}>
            {detail}
          </Text>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const useStyles = makeStyles((c, scheme) =>
  StyleSheet.create({
    scroll: { flexGrow: 1, paddingBottom: 120, backgroundColor: c.paper },
    flex: { flex: 1 },
    white: { color: "#FFFFFF" },
    pressed: { opacity: 0.8 },
    root: { flex: 1, backgroundColor: c.paper },
    header: {
      backgroundColor: scheme === "dark" ? c.forest : "#15803D",
      paddingHorizontal: space.gutter + 4,
      paddingBottom: 96,
      borderBottomLeftRadius: radius.lg + 2,
      borderBottomRightRadius: radius.lg + 2,
      overflow: "hidden",
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: space.lg,
      width: "100%",
      maxWidth: 1080,
      alignSelf: "center",
    },
    guardianRow: { flexDirection: "row", alignItems: "center", gap: space.md },
    guardianAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
    guardianInitials: { color: "#15803D" },
    headerSoft: { color: "#D5F0DE" },
    headerName: { color: "#FFFFFF", fontSize: 20, lineHeight: 26 },
    bell: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.16)" },
    bellDot: {
      position: "absolute",
      top: 10,
      right: 11,
      width: 10,
      height: 10,
      borderRadius: 5,
      borderWidth: 2,
      borderColor: scheme === "dark" ? c.forest : "#15803D",
    },
    body: { width: "100%", maxWidth: 1080, alignSelf: "center", paddingHorizontal: space.gutter, gap: space.lg, marginTop: -76 },
    childCard: {
      backgroundColor: c.surface,
      borderRadius: radius.md + 2,
      padding: space.lg + 2,
      gap: space.lg,
      ...(scheme === "dark" ? { borderWidth: 1, borderColor: c.rule } : shadow(scheme, "float")),
    },
    childRow: { flexDirection: "row", alignItems: "center", gap: space.md + 2 },
    childCopy: { flex: 1, minWidth: 0, gap: 3 },
    statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    battery: { alignItems: "flex-end" },
    stats: { flexDirection: "row", borderTopWidth: 1, borderTopColor: c.rule, paddingTop: space.md },
    stat: { flex: 1, gap: 2, paddingVertical: space.xs },
    statValue: { fontSize: 20, lineHeight: 26 },
    statRule: { width: 1, backgroundColor: c.rule, marginHorizontal: space.md },
    empty: { alignItems: "center", gap: space.md, paddingVertical: space.md },
    emptyIcon: { width: 60, height: 60, borderRadius: 20, backgroundColor: c.primaryTint, alignItems: "center", justifyContent: "center" },
    sectionHeader: { flexDirection: "row", alignItems: "flex-end", gap: space.md, marginTop: space.sm },
    linkRow: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 36 },
    tiles: { flexDirection: "row", gap: space.sm + 2 },
    tileCell: { flex: 1 },
    tile: {
      alignItems: "center",
      gap: space.sm,
      paddingVertical: space.md + 2,
      paddingHorizontal: space.xs,
      borderRadius: radius.md - 2,
      backgroundColor: c.surface,
      ...(scheme === "dark" ? { borderWidth: 1, borderColor: c.rule } : shadow(scheme)),
    },
    tileIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: c.primaryTint },
    tileDetail: { marginTop: -6 },
    deviceLine: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center" },
    sosBand: { backgroundColor: "#B42318" },
    sosRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      paddingHorizontal: space.gutter + 4,
      paddingVertical: space.md,
      width: "100%",
      maxWidth: 1080,
      alignSelf: "center",
    },
    sosIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
    sosHalo: { position: "absolute", width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFFFFF" },
    sosEyebrow: { color: "#FFE1DD" },
    sosOpen: { paddingHorizontal: space.lg, minHeight: 36, borderRadius: radius.pill, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
    sosOpenText: { color: "#B42318" },
  }),
);
