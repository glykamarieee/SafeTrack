import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { Animated, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useSelectedChild } from "../../hooks/useSelectedChild";
import { usePlaceDetails } from "../../hooks/usePlaceDetails";
import { PlaceDetailsCard } from "../../components/location/PlaceDetailsCard";
import { useAuthStore } from "../../store/authStore";
import { useLocationStore } from "../../store/locationStore";
import { useGeofenceStore } from "../../store/geofenceStore";
import { LocationMapCard } from "../../components/location/LocationMapCard";
import { childRing, toZoneCircles } from "../../components/location/zoneCircles";
import { freshness } from "../../components/location/mapTypes";
import { useSosStore } from "../../store/sosStore";
import { fetchSmartwatchForChild, type SmartwatchStatus } from "../../services/smartwatchService";
import { Text } from "../../components/ui/Text";
import { useEntrance, usePulse } from "../../theme/motion";
import { makeStyles, useTheme } from "../../theme/ThemeProvider";
import { radius, shadow, space } from "../../theme/tokens";

/** Space the tab bar takes at the bottom of the screen. */
const TAB_BAR = 78;

function ago(value?: string | null) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function clockTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
}

export default function LocationScreen() {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= 960;

  const role = useAuthStore((state) => state.role);
  const child = useAuthStore((state) => state.child);
  const { child: selected } = useSelectedChild();

  const primaryChild = role === "child" ? child : selected;

  const location = useLocationStore((state) => state.latest);
  const history = useLocationStore((state) => state.history);
  const loading = useLocationStore((state) => state.isLoading);
  const load = useLocationStore((state) => state.loadForChild);
  const subscribe = useLocationStore((state) => state.subscribeToChildLocation);
  const guardianId = useAuthStore((state) => state.guardian?.id);
  const zones = useGeofenceStore((state) => state.zones);
  const zoneEvents = useGeofenceStore((state) => state.events);
  const loadZones = useGeofenceStore((state) => state.load);
  const sosAlerts = useSosStore((state) => state.alerts);
  const loadSos = useSosStore((state) => state.loadForChild);
  const [watch, setWatch] = useState<SmartwatchStatus | null>(null);

  const trackingSource = primaryChild?.trackingSource ?? "mobile";
  const supportedTrackingSource = trackingSource === "mobile" || trackingSource === "both" ? trackingSource : "smartwatch";

  useEffect(() => {
    if (primaryChild?.id) {
      void load(primaryChild.id);
    }
  }, [primaryChild?.id]);

  // New locations arrive through realtime; the map moves the marker in place
  // without moving the camera.
  useEffect(() => {
    if (!primaryChild?.id) return;

    return subscribe(primaryChild.id, primaryChild.fullName ?? "Child");
  }, [primaryChild?.id, primaryChild?.fullName, subscribe]);

  useEffect(() => {
    if (guardianId && primaryChild?.id) {
      void loadZones(guardianId, primaryChild.id);
    }
  }, [guardianId, primaryChild?.id, loadZones]);

  // Active SOS (red ring) and the watch's current battery for the child marker.
  useEffect(() => {
    if (!primaryChild?.id) return;
    void loadSos(primaryChild.id, primaryChild.fullName ?? "Child");

    if (trackingSource === "mobile") {
      setWatch(null);
      return;
    }
    let active = true;
    fetchSmartwatchForChild(primaryChild.id)
      .then((value) => active && setWatch(value))
      .catch(() => active && setWatch(null));

    return () => {
      active = false;
    };
  }, [primaryChild?.id, primaryChild?.fullName, trackingSource, loadSos]);

  const sosActive = sosAlerts.some((alert) => alert.childId === primaryChild?.id && alert.status === "active");

  const zoneCircles = useMemo(() => toZoneCircles(zones, zoneEvents), [zones, zoneEvents]);
  const details = usePlaceDetails(location, history, zoneCircles);

  // The last 10 minutes behind the child, oldest first.
  const trail = useMemo(() => {
    if (!location) return [];
    const since = Date.parse(location.recordedAt) - 10 * 60_000;
    return history
      .filter((point) => point.childId === location.childId && point.id !== location.id && Date.parse(point.recordedAt) >= since)
      .sort((first, second) => Date.parse(first.recordedAt) - Date.parse(second.recordedAt))
      .map((point) => ({ latitude: point.latitude, longitude: point.longitude }));
  }, [history, location]);

  const refresh = () => {
    if (primaryChild?.id) {
      void load(primaryChild.id);
    }
  };

  // ---- Status for the top card: the same rule as the marker's ring.
  const fresh = freshness(location?.recordedAt);
  const ring = childRing(zoneCircles, { sosActive, freshness: fresh });
  const inside = zoneCircles.find((circle) => circle.status === "inside");
  const name = primaryChild?.fullName?.split(/\s+/)[0] ?? "Your child";
  const age = ago(location?.recordedAt);

  const where = location?.locationLabel || details.place?.label || null;
  const status: { icon: ComponentProps<typeof Ionicons>["name"]; tile: string; title: string; detail: string } = !location
    ? { icon: "time-outline", tile: colors.forestRaised, title: "Waiting for a location", detail: "The map focuses when the child's device sends one." }
    : ring === "sos"
      ? { icon: "alert", tile: "#B42318", title: `${name} needs help`, detail: "SOS active · open SOS alerts" }
      : ring === "stale"
        ? { icon: "cloud-offline-outline", tile: "#8C948F", title: `Last seen ${age ?? ""}`.trim(), detail: where ?? "No newer location received" }
        : ring === "inside"
          ? {
              icon: "shield-checkmark",
              tile: "#22B35E",
              title: `Inside ${inside?.label ?? "a safe zone"}`,
              detail: `${name} arrived ${clockTime(inside?.lastEventAt) ?? "earlier"}${where ? ` · ${where}` : ""}`,
            }
          : ring === "outside"
            ? { icon: "walk-outline", tile: "#F5B83D", title: "Outside safe zones", detail: where ?? `${name}'s latest location` }
            : { icon: "location", tile: "#22B35E", title: where ?? `${name}'s location`, detail: "No safe zones set up yet" };

  const mapHeight = Math.max(420, height - TAB_BAR);
  const top = useEntrance(0, -20, 420);
  const bottom = useEntrance(2, 40, 420);
  const pulse = usePulse(fresh === "fresh" && Boolean(location), 1600);

  return (
    <View style={styles.root}>
      <LocationMapCard
        location={location}
        height={mapHeight}
        loading={loading}
        trackingSource={supportedTrackingSource}
        onRefresh={refresh}
        zones={zoneCircles}
        avatarPath={primaryChild?.avatarPath}
        avatarUrl={primaryChild?.avatarUrl}
        sosActive={sosActive}
        batteryPercent={watch?.batteryPercent ?? null}
        networkType={watch?.networkType ?? null}
        overlays={false}
        bottomInset={location ? 300 : undefined}
        topInset={location ? 100 + insets.top : 0}
        trail={trail}
        flush
      />

      <SafeAreaView pointerEvents="box-none" edges={["top"]} style={styles.topLayer}>
        <Animated.View style={[styles.topCard, wide && styles.narrow, top]}>
          <Pressable
            accessibilityRole={ring === "sos" ? "button" : undefined}
            disabled={ring !== "sos"}
            onPress={() => router.push("/(app)/sos-alerts")}
            style={styles.topRow}
          >
            <View style={[styles.statusTile, { backgroundColor: status.tile }]}>
              <Ionicons name={status.icon} size={26} color="#FFFFFF" />
            </View>
            <View style={styles.flex}>
              <Text variant="heading" weight="800" style={styles.white} numberOfLines={1}>
                {status.title}
              </Text>
              <Text variant="label" weight="500" style={styles.topDetail} numberOfLines={1}>
                {status.detail}
              </Text>
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Check for a newer location"
            onPress={refresh}
            hitSlop={6}
            style={({ pressed }) => [styles.refresh, pressed && { opacity: 0.75 }]}
          >
            <Ionicons name={loading ? "sync-outline" : "refresh"} size={18} color="#FFFFFF" />
          </Pressable>
        </Animated.View>
      </SafeAreaView>

      {location ? (
        <Animated.View pointerEvents="box-none" style={[styles.bottomLayer, wide && styles.narrow, bottom]}>
          <PlaceDetailsCard
            location={location}
            details={details}
            batteryPercent={watch?.batteryPercent ?? null}
            networkType={watch?.networkType ?? null}
            tone="dark"
            compact={!wide && height < 760}
          />

          <View style={styles.glassBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open today's activity"
              onPress={() => router.push("/(app)/history")}
              style={({ pressed }) => [styles.barButton, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="time-outline" size={21} color={colors.primary} />
            </Pressable>
            <View style={styles.barCenter}>
              <View style={styles.barTitle}>
                <View style={styles.dotWrap}>
                  <Animated.View
                    style={[
                      styles.dotHalo,
                      {
                        backgroundColor: fresh === "fresh" ? colors.brand : fresh === "stale" ? colors.warningFill : colors.offline,
                        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
                        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: fresh === "fresh" ? colors.brand : fresh === "stale" ? colors.warningFill : colors.offline },
                    ]}
                  />
                </View>
                <Text variant="heading" weight="800" tabular>
                  {details.live ? "Live" : `Updated ${age ?? "—"}`}
                </Text>
              </View>
              <Text variant="caption" numberOfLines={1}>
                {details.live ? "Moving with the child" : "Latest reported location"}
                {location.accuracyMeters != null ? ` · ±${Math.round(location.accuracyMeters)} m` : ""}
                {` · from ${location.source === "smartwatch" ? "watch" : "phone"}`}
                {watch?.batteryPercent != null && location.source === "smartwatch" ? ` · ${watch.batteryPercent}%` : ""}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open safe zones"
              onPress={() => router.push("/(app)/safe-zones")}
              style={({ pressed }) => [styles.barButton, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="radio-button-on-outline" size={21} color={colors.primary} />
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c, scheme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.mapGround },
    flex: { flex: 1, minWidth: 0 },
    white: { color: "#FFFFFF" },
    narrow: { width: "100%", maxWidth: 560, alignSelf: "center" },
    topLayer: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: space.md + 2 },
    topCard: {
      marginTop: space.sm,
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      padding: space.md + 2,
      borderRadius: radius.md,
      backgroundColor: scheme === "dark" ? c.forest : "#0D2A1E",
      ...shadow(scheme, "float"),
    },
    topRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.md },
    statusTile: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
    topDetail: { color: "#BFD8C9" },
    refresh: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.12)",
    },
    bottomLayer: { position: "absolute", left: 0, right: 0, bottom: space.lg, paddingHorizontal: space.md + 2, gap: space.sm },
    note: {
      flexDirection: "row",
      gap: space.sm,
      padding: space.md,
      borderRadius: radius.sm,
      backgroundColor: "rgba(13, 42, 30, 0.92)",
    },
    noteIcon: { marginTop: 1 },
    noteText: { flex: 1, color: "#D5E6DC" },
    glassBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      padding: space.md - 2,
      borderRadius: radius.md + 2,
      backgroundColor: c.glass,
      borderWidth: 1,
      borderColor: c.glassBorder,
      ...shadow(scheme, "float"),
    },
    barButton: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.primaryTint,
    },
    barCenter: { flex: 1, minWidth: 0, alignItems: "center", gap: 2 },
    barTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
    dotWrap: { width: 10, height: 10, alignItems: "center", justifyContent: "center" },
    dotHalo: { position: "absolute", width: 10, height: 10, borderRadius: 5 },
    dot: { width: 10, height: 10, borderRadius: 5 },
  }),
);
