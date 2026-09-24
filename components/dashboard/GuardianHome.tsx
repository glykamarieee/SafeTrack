import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useAuthStore } from "../../store/authStore";
import { useLocationStore } from "../../store/locationStore";
import { useSosStore } from "../../store/sosStore";
import { useGeofenceStore } from "../../store/geofenceStore";
import { useAnomalyStore } from "../../store/anomalyStore";
import {
  fetchSmartwatchForChild,
  type SmartwatchStatus,
} from "../../services/smartwatchService";
import { LocationMapCard } from "../location/LocationMapCard";

import {
  guardianColors as colors,
  guardianRadius as radius,
  guardianShadow as shadow,
  guardianSpacing as spacing,
} from "../../constants/guardianDesign";

function formatTime(value?: string | null) {
  if (!value) return "No recent update";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Latest stored update";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours} hr${hours === 1 ? "" : "s"} ago`;
  return `Updated ${Math.floor(hours / 24)} day${hours < 48 ? "" : "s"} ago`;
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

export function GuardianHome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 1040;

  const guardian = useAuthStore((state) => state.guardian);
  const child = useAuthStore((state) => state.linkedChildren?.[0] ?? null);

  const latestLocation = useLocationStore((state) => state.latest);
  const locationHistory = useLocationStore((state) => state.history);
  const locationLoading = useLocationStore((state) => state.isLoading);
  const loadLocation = useLocationStore((state) => state.loadForChild);

  const sosAlerts = useSosStore((state) => state.alerts);
  const loadSos = useSosStore((state) => state.loadForChild);

  const zones = useGeofenceStore((state) => state.zones);
  const loadZones = useGeofenceStore((state) => state.load);

  const latestAnomaly = useAnomalyStore((state) => state.latestAnomaly);
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

  const activeSOS = useMemo(
    () => sosAlerts.find((item) => item.status === "active"),
    [sosAlerts],
  );

  const safetyTone = !child
    ? "Register a child to begin"
    : activeSOS
      ? "SOS needs attention"
      : latestAnomaly
        ? "Review a safety notice"
        : "No active SOS or anomaly notice";

  const safetyIcon: keyof typeof Ionicons.glyphMap = activeSOS
    ? "warning"
    : latestAnomaly
      ? "analytics-outline"
      : "shield-checkmark";

  const watchStatus = !child
    ? "No child setup"
    : !hasWatch
      ? "Phone source"
      : watch?.connectionStatus === "connected"
        ? "Watch connected"
        : "Watch not recently connected";

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      <View style={styles.topbar}>
        <View>
          <Text style={styles.brand}>SAFETRACK</Text>
          <Text style={styles.greeting}>Hi, {firstName(guardian?.fullName)}</Text>
        </View>

        <Pressable
          accessibilityLabel="Open notifications"
          style={({ pressed }) => [styles.notificationButton, pressed && styles.pressed]}
          onPress={() => router.push("/(app)/notifications")}
        >
          <Ionicons name="notifications-outline" size={23} color={colors.primaryDeep} />
          {(activeSOS || latestAnomaly) && <View style={styles.notificationDot} />}
        </Pressable>
      </View>

      <LinearGradient
        colors={[colors.heroTop, colors.heroBottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroGlowOne} />
        <View style={styles.heroGlowTwo} />

        <View style={styles.heroTopRow}>
          <View style={styles.childAvatar}>
            <Text style={styles.childAvatarText}>{initials(child?.fullName)}</Text>
          </View>

          <View style={styles.childCopy}>
            <Text style={styles.heroKicker}>MONITORING</Text>
            <Text numberOfLines={1} style={styles.childName}>
              {child?.fullName ?? "Register a child profile"}
            </Text>
            {child ? (
              <Text style={styles.childMeta}>
                {child.age ?? "—"} years old
                {child.relationship ? `  •  ${child.relationship}` : ""}
              </Text>
            ) : null}
          </View>

          <Pressable
            accessibilityLabel="Edit child profile"
            style={({ pressed }) => [styles.heroEdit, pressed && styles.pressed]}
            onPress={() => {
              if (!child) return;
              router.push({
                pathname: "/(app)/edit-child-profile",
                params: { childId: child.id, section: "details" },
              });
            }}
          >
            <Ionicons name="create-outline" size={18} color={colors.white} />
          </Pressable>
        </View>

        <View style={styles.statusStrip}>
          <View style={styles.statusItem}>
            <View
              style={[
                styles.statusIcon,
                activeSOS
                  ? styles.statusIconDanger
                  : latestAnomaly
                    ? styles.statusIconWarning
                    : styles.statusIconGreen,
              ]}
            >
              <Ionicons
                name={safetyIcon}
                size={15}
                color={
                  activeSOS
                    ? colors.dangerDark
                    : latestAnomaly
                      ? colors.warning
                      : colors.primaryDeep
                }
              />
            </View>
            <View style={styles.statusCopy}>
              <Text style={styles.statusLabel}>Safety pulse</Text>
              <Text numberOfLines={1} style={styles.statusValue}>{safetyTone}</Text>
            </View>
          </View>

          <View style={styles.statusDivider} />

          <View style={styles.statusItem}>
            <View style={styles.statusIcon}>
              <Ionicons name={hasWatch ? "watch-outline" : "phone-portrait-outline"} size={15} color={colors.white} />
            </View>
            <View style={styles.statusCopy}>
              <Text style={styles.statusLabel}>Device</Text>
              <Text numberOfLines={1} style={styles.statusValue}>{watchStatus}</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionEyebrow}>LIVE LOCATION</Text>
          <Text style={styles.sectionTitle}>Latest available position</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
          onPress={() => router.push("/(app)/location")}
        >
          <Text style={styles.textButtonLabel}>Open map</Text>
          <Ionicons name="arrow-forward" size={15} color={colors.primaryDark} />
        </Pressable>
      </View>

      <LocationMapCard
        location={latestLocation}
        loading={locationLoading}
        trackingSource={
          trackingSource === "mobile" || trackingSource === "both"
            ? trackingSource
            : "smartwatch"
        }
        height={wide ? 500 : 385}
        onRefresh={() => child && loadLocation(child.id, child.fullName)}
      />

      <View style={styles.locationFootnote}>
        <Ionicons name="time-outline" size={15} color={colors.primaryDark} />
        <Text style={styles.locationFootnoteText}>
          {latestLocation
            ? `${formatTime(latestLocation.recordedAt)} • ${latestLocation.source === "smartwatch" ? "Smartwatch" : "Mobile device"}`
            : "Waiting for the registered child device to send a location update."}
        </Text>
      </View>

      <View style={styles.sectionHeaderRowCompact}>
        <View>
          <Text style={styles.sectionEyebrow}>AT A GLANCE</Text>
          <Text style={styles.sectionTitle}>Safety summary</Text>
        </View>
      </View>

      <View style={styles.summaryRail}>
        <Pressable
          style={({ pressed }) => [styles.summaryItem, pressed && styles.pressed]}
          onPress={() => router.push("/(app)/safe-zones")}
        >
          <View style={[styles.summaryIcon, { backgroundColor: colors.softMint }]}> 
            <Ionicons name="map-outline" size={20} color={colors.primaryDark} />
          </View>
          <Text style={styles.summaryValue}>{zones.length}</Text>
          <Text style={styles.summaryLabel}>Safe zones</Text>
        </Pressable>

        <View style={styles.summaryLine} />

        <Pressable
          style={({ pressed }) => [styles.summaryItem, pressed && styles.pressed]}
          onPress={() => router.push("/(app)/safety-center")}
        >
          <View style={[styles.summaryIcon, { backgroundColor: latestAnomaly ? colors.warningSoft : colors.softMint }]}> 
            <Ionicons name="sparkles-outline" size={20} color={latestAnomaly ? colors.warning : colors.primaryDark} />
          </View>
          <Text style={styles.summaryValue}>{latestAnomaly ? "Review" : "No notice"}</Text>
          <Text style={styles.summaryLabel}>AI notice</Text>
        </Pressable>

        <View style={styles.summaryLine} />

        <Pressable
          style={({ pressed }) => [styles.summaryItem, pressed && styles.pressed]}
          onPress={() => router.push("/(app)/sos-alerts")}
        >
          <View style={[styles.summaryIcon, { backgroundColor: activeSOS ? colors.dangerSoft : colors.softMint }]}> 
            <Ionicons name="warning-outline" size={20} color={activeSOS ? colors.danger : colors.primaryDark} />
          </View>
          <Text style={styles.summaryValue}>{activeSOS ? "Active" : "Clear"}</Text>
          <Text style={styles.summaryLabel}>SOS status</Text>
        </Pressable>
      </View>

      <View style={styles.activityBand}>
        <View style={styles.activityBandIcon}>
          <Ionicons name="pulse-outline" size={23} color={colors.primaryDark} />
        </View>
        <View style={styles.activityBandCopy}>
          <Text style={styles.activityBandTitle}>Recent recorded activity</Text>
          <Text style={styles.activityBandText}>
            {locationHistory.length} recent location record{locationHistory.length === 1 ? "" : "s"} • {sosAlerts.length} SOS record{sosAlerts.length === 1 ? "" : "s"}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Open activity history"
          style={({ pressed }) => [styles.activityArrow, pressed && styles.pressed]}
          onPress={() => router.push("/(app)/history")}
        >
          <Ionicons name="arrow-forward" size={19} color={colors.primaryDeep} />
        </Pressable>
      </View>

      <Text style={styles.sectionEyebrow}>QUICK ACTIONS</Text>
      <View style={styles.quickActions}>
        <Pressable
          style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}
          onPress={() => router.push("/(app)/safe-zones")}
        >
          <View style={styles.quickIcon}><Ionicons name="add-circle-outline" size={19} color={colors.primaryDark} /></View>
          <Text style={styles.quickLabel}>Safe zones</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}
          onPress={() => {
            if (!child) return;
            router.push({
              pathname: "/(app)/device-connection-code",
              params: { childId: child.id, section: "details" },
            });
          }}
        >
          <View style={styles.quickIcon}><Ionicons name="key-outline" size={19} color={colors.primaryDark} /></View>
          <Text style={styles.quickLabel}>Connection code</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}
          onPress={() => router.push("/(app)/notifications")}
        >
          <View style={styles.quickIcon}><Ionicons name="notifications-outline" size={19} color={colors.primaryDark} /></View>
          <Text style={styles.quickLabel}>Notices</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 1160,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 128,
    backgroundColor: colors.background,
  },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  brand: {
    color: colors.primary,
    fontSize: 10.5,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  greeting: {
    marginTop: 3,
    color: colors.ink,
    fontSize: 29,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  notificationButton: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  notificationDot: {
    position: "absolute",
    right: 10,
    top: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.white,
  },
  hero: {
    minHeight: 215,
    borderRadius: radius.xl,
    padding: 20,
    overflow: "hidden",
    marginBottom: 28,
    ...shadow.floating,
  },
  heroGlowOne: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    right: -55,
    top: -72,
    backgroundColor: "rgba(117, 235, 174, 0.12)",
  },
  heroGlowTwo: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    left: -52,
    bottom: -88,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  childAvatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.5)",
  },
  childAvatarText: {
    color: colors.primaryDark,
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  childCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 13,
  },
  heroKicker: {
    color: "rgba(255,255,255,.68)",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  childName: {
    marginTop: 3,
    color: colors.white,
    fontSize: 23,
    lineHeight: 28,
    fontWeight: "900",
  },
  childMeta: {
    marginTop: 3,
    color: "rgba(255,255,255,.72)",
    fontSize: 11.5,
    fontWeight: "600",
  },
  heroEdit: {
    width: 39,
    height: 39,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.18)",
  },
  statusStrip: {
    marginTop: 24,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 21,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(4,37,27,.26)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.09)",
  },
  statusItem: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  statusIcon: {
    width: 31,
    height: 31,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.12)",
  },
  statusIconGreen: {
    backgroundColor: colors.mintGlow,
  },
  statusIconWarning: {
    backgroundColor: colors.warningSoft,
  },
  statusIconDanger: {
    backgroundColor: colors.dangerSoft,
  },
  statusCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 8,
  },
  statusLabel: {
    color: "rgba(255,255,255,.58)",
    fontSize: 8.5,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  statusValue: {
    marginTop: 2,
    color: colors.white,
    fontSize: 10.5,
    fontWeight: "800",
  },
  statusDivider: {
    width: 1,
    height: 34,
    marginHorizontal: 10,
    backgroundColor: "rgba(255,255,255,.14)",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 13,
  },
  sectionHeaderRowCompact: {
    marginTop: 30,
    marginBottom: 14,
  },
  sectionEyebrow: {
    color: colors.primaryDark,
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 1.35,
  },
  sectionTitle: {
    marginTop: 3,
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  textButton: {
    minHeight: 36,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
  },
  textButtonLabel: {
    marginRight: 4,
    color: colors.primaryDark,
    fontSize: 10.5,
    fontWeight: "900",
  },
  locationFootnote: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingHorizontal: 4,
  },
  locationFootnoteText: {
    flex: 1,
    marginLeft: 7,
    color: colors.muted,
    fontSize: 10.5,
    lineHeight: 15,
  },
  summaryRail: {
    minHeight: 116,
    borderRadius: radius.lg,
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 5,
  },
  summaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryValue: {
    marginTop: 8,
    color: colors.ink,
    fontSize: 13.5,
    fontWeight: "900",
  },
  summaryLabel: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 9.5,
    fontWeight: "700",
  },
  summaryLine: {
    width: 1,
    marginVertical: 18,
    backgroundColor: colors.border,
  },
  activityBand: {
    marginTop: 16,
    marginBottom: 28,
    padding: 15,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.softMint,
  },
  activityBandIcon: {
    width: 45,
    height: 45,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  activityBandCopy: {
    flex: 1,
    marginLeft: 11,
  },
  activityBandTitle: {
    color: colors.ink,
    fontSize: 12.5,
    fontWeight: "900",
  },
  activityBandText: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 10.5,
    lineHeight: 15,
  },
  activityArrow: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  quickAction: {
    minHeight: 43,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  quickLabel: {
    marginLeft: 7,
    color: colors.ink,
    fontSize: 10.5,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
});
