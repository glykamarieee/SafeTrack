import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import { useSosStore } from "../../store/sosStore";

import {
  guardianColors as colors,
  guardianRadius as radius,
  guardianShadow as shadow,
  guardianSpacing as spacing,
} from "../../constants/guardianDesign";

function trackingCopy(source?: string) {
  if (source === "both") return "Smartwatch primary • mobile additional";
  if (source === "mobile") return "Mobile location source";
  return "Smartwatch primary source";
}

export default function SafetyCenterScreen() {
  const router = useRouter();

  const guardian = useAuthStore((state) => state.guardian);
  const children = useAuthStore((state) => state.linkedChildren);
  const alerts = useSosStore((state) => state.alerts);
  const loadSos = useSosStore((state) => state.loadForChild);

  const child = children[0] ?? null;
  const trackingSource = child?.trackingSource ?? "smartwatch";

  const [activeZoneCount, setActiveZoneCount] = useState(0);
  const [loadingZones, setLoadingZones] = useState(true);

  const activeSosCount = alerts.filter((alert) => alert.status === "active").length;

  useEffect(() => {
    if (child?.id) {
      void loadSos(child.id);
    }
  }, [child?.id, loadSos]);

  useEffect(() => {
    const loadActiveSafeZones = async () => {
      if (!guardian?.id || !child?.id) {
        setActiveZoneCount(0);
        setLoadingZones(false);
        return;
      }

      setLoadingZones(true);

      const { count, error } = await supabase
        .from("geofences")
        .select("id", { count: "exact", head: true })
        .eq("guardian_id", guardian.id)
        .eq("child_id", child.id)
        .eq("is_enabled", true);

      if (!error) setActiveZoneCount(count ?? 0);
      setLoadingZones(false);
    };

    void loadActiveSafeZones();
  }, [guardian?.id, child?.id]);

  const safeZoneDescription = loadingZones
    ? "Loading guardian-defined safe zones..."
    : activeZoneCount === 0
      ? "No active safe zones yet. Add one for entry and exit notices."
      : `${activeZoneCount} active safe zone${activeZoneCount === 1 ? "" : "s"} monitoring boundary changes.`;

  const sosDescription = activeSosCount > 0
    ? `${activeSosCount} active SOS alert${activeSosCount === 1 ? "" : "s"} requires acknowledgement.`
    : "No active SOS alert currently requires acknowledgement.";

  const openSafeZones = () => router.push("/safe-zones" as Href);
  const openSosAlerts = () => router.push("/sos-alerts" as Href);
  const openLocation = () => router.push("/location" as Href);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>SAFETY CENTER</Text>
        <Text style={styles.heading}>Clear signals. Calm decisions.</Text>
        <Text style={styles.subtitle}>
          Review SafeTrack monitoring information without treating every device event as an emergency.
        </Text>

        <LinearGradient
          colors={activeSosCount > 0 ? ["#713A3F", "#A84750"] : [colors.heroTop, colors.heroBottom]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.pulseHero}
        >
          <View style={styles.pulseGlow} />
          <View style={styles.pulseTopRow}>
            <View style={[styles.pulseIcon, activeSosCount > 0 && styles.pulseIconDanger]}>
              <Ionicons
                name={activeSosCount > 0 ? "warning" : "shield-checkmark"}
                size={27}
                color={activeSosCount > 0 ? colors.dangerDark : colors.primaryDeep}
              />
            </View>

            <View style={styles.pulseCopy}>
              <Text style={styles.pulseKicker}>CURRENT SAFETY PULSE</Text>
              <Text style={styles.pulseTitle}>
                {activeSosCount > 0 ? "SOS needs guardian attention" : "No active SOS requires action"}
              </Text>
            </View>
          </View>

          <Text style={styles.pulseDescription}>{sosDescription}</Text>

          <View style={styles.pulseFooter}>
            <View style={styles.pulseSourceChip}>
              <Ionicons
                name={trackingSource === "mobile" ? "phone-portrait-outline" : "watch-outline"}
                size={14}
                color={colors.white}
              />
              <Text style={styles.pulseSourceText}>{trackingCopy(trackingSource)}</Text>
            </View>

            <Pressable
              onPress={openSosAlerts}
              style={({ pressed }) => [styles.reviewButton, pressed && styles.pressed]}
            >
              <Text style={styles.reviewButtonText}>Review SOS</Text>
              <Ionicons name="arrow-forward" size={15} color={colors.primaryDeep} />
            </Pressable>
          </View>
        </LinearGradient>

        <View style={styles.sectionHeadingRow}>
          <View>
            <Text style={styles.sectionEyebrow}>MONITORING LAYERS</Text>
            <Text style={styles.sectionTitle}>What SafeTrack is watching</Text>
          </View>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>{child?.fullName ?? "Child"}</Text>
          </View>
        </View>

        <View style={styles.monitoringPanel}>
          <Pressable
            onPress={openSafeZones}
            style={({ pressed }) => [styles.monitorRow, pressed && styles.rowPressed]}
          >
            <View style={styles.rowIconGreen}>
              <Ionicons name="map-outline" size={21} color={colors.primaryDark} />
            </View>
            <View style={styles.rowCopy}>
              <View style={styles.rowTitleLine}>
                <Text style={styles.rowTitle}>Safe-zone boundaries</Text>
                <Text style={styles.rowStatusGreen}>
                  {loadingZones ? "..." : `${activeZoneCount} active`}
                </Text>
              </View>
              <Text style={styles.rowDescription}>{safeZoneDescription}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.mutedLight} />
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            onPress={openLocation}
            style={({ pressed }) => [styles.monitorRow, pressed && styles.rowPressed]}
          >
            <View style={styles.rowIconBlue}>
              <Ionicons name="analytics-outline" size={21} color={colors.accentBlue} />
            </View>
            <View style={styles.rowCopy}>
              <View style={styles.rowTitleLine}>
                <Text style={styles.rowTitle}>Movement-pattern review</Text>
                <Text style={styles.rowStatusNeutral}>Advisory</Text>
              </View>
              <Text style={styles.rowDescription}>
                Explainable anomaly notices are for guardian review and do not confirm danger.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.mutedLight} />
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            onPress={openSosAlerts}
            style={({ pressed }) => [styles.monitorRow, pressed && styles.rowPressed]}
          >
            <View style={activeSosCount > 0 ? styles.rowIconDanger : styles.rowIconSoft}>
              <Ionicons
                name="warning-outline"
                size={21}
                color={activeSosCount > 0 ? colors.danger : colors.primaryDark}
              />
            </View>
            <View style={styles.rowCopy}>
              <View style={styles.rowTitleLine}>
                <Text style={styles.rowTitle}>SOS acknowledgement</Text>
                <Text style={activeSosCount > 0 ? styles.rowStatusDanger : styles.rowStatusGreen}>
                  {activeSosCount > 0 ? `${activeSosCount} active` : "Clear"}
                </Text>
              </View>
              <Text style={styles.rowDescription}>
                Confirmed SOS records stay visible until the authorized guardian acknowledges them.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.mutedLight} />
          </Pressable>
        </View>

        <View style={styles.explainBand}>
          <View style={styles.explainIcon}>
            <Ionicons name="sparkles-outline" size={20} color={colors.primaryDark} />
          </View>
          <View style={styles.explainCopy}>
            <Text style={styles.explainTitle}>Designed for explainable monitoring</Text>
            <Text style={styles.explainText}>
              SafeTrack separates geofence events, possible movement anomalies, and SOS alerts so each signal can be reviewed in context.
            </Text>
          </View>
        </View>

        <View style={styles.footerNote}>
          <Ionicons name="information-circle-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.footerText}>
            Safety notices depend on successfully received device data, connectivity, permissions, GPS/GNSS conditions, and system availability.
          </Text>
        </View>
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
    width: "100%",
    maxWidth: 1080,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: 30,
    paddingBottom: 118,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  heading: {
    maxWidth: 350,
    marginTop: 7,
    color: colors.ink,
    fontSize: 30,
    lineHeight: 35,
    fontWeight: "900",
    letterSpacing: -0.9,
  },
  subtitle: {
    maxWidth: 355,
    marginTop: 8,
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 18.5,
  },
  pulseHero: {
    marginTop: 26,
    borderRadius: radius.xl,
    padding: 19,
    overflow: "hidden",
    ...shadow.floating,
  },
  pulseGlow: {
    position: "absolute",
    right: -40,
    top: -55,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "rgba(255,255,255,.08)",
  },
  pulseTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  pulseIcon: {
    width: 56,
    height: 56,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.mintGlow,
  },
  pulseIconDanger: {
    backgroundColor: "#FFE4E7",
  },
  pulseCopy: {
    flex: 1,
    marginLeft: 13,
  },
  pulseKicker: {
    color: "rgba(255,255,255,.60)",
    fontSize: 8.5,
    fontWeight: "900",
    letterSpacing: 1.25,
  },
  pulseTitle: {
    marginTop: 4,
    color: colors.white,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "900",
  },
  pulseDescription: {
    marginTop: 15,
    color: "rgba(255,255,255,.76)",
    fontSize: 11.5,
    lineHeight: 17,
  },
  pulseFooter: {
    marginTop: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pulseSourceChip: {
    minHeight: 33,
    maxWidth: "58%",
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,.14)",
  },
  pulseSourceText: {
    marginLeft: 6,
    color: colors.white,
    fontSize: 9.5,
    fontWeight: "800",
  },
  reviewButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
  },
  reviewButtonText: {
    marginRight: 5,
    color: colors.primaryDeep,
    fontSize: 10,
    fontWeight: "900",
  },
  sectionHeadingRow: {
    marginTop: 31,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  sectionEyebrow: {
    color: colors.primaryDark,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  sectionTitle: {
    marginTop: 3,
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
  },
  sectionBadge: {
    maxWidth: 120,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.softMint,
  },
  sectionBadgeText: {
    color: colors.primaryDark,
    fontSize: 9.5,
    fontWeight: "800",
  },
  monitoringPanel: {
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  monitorRow: {
    minHeight: 104,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  rowPressed: {
    opacity: 0.76,
  },
  rowIconGreen: {
    width: 47,
    height: 47,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
  },
  rowIconBlue: {
    width: 47,
    height: 47,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAF1FF",
  },
  rowIconDanger: {
    width: 47,
    height: 47,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.dangerSoft,
  },
  rowIconSoft: {
    width: 47,
    height: 47,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
    marginRight: 8,
  },
  rowTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: 13.5,
    fontWeight: "900",
  },
  rowStatusGreen: {
    marginLeft: 8,
    color: colors.primaryDark,
    fontSize: 9,
    fontWeight: "900",
  },
  rowStatusNeutral: {
    marginLeft: 8,
    color: colors.accentBlue,
    fontSize: 9,
    fontWeight: "900",
  },
  rowStatusDanger: {
    marginLeft: 8,
    color: colors.danger,
    fontSize: 9,
    fontWeight: "900",
  },
  rowDescription: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 10.5,
    lineHeight: 15.5,
  },
  divider: {
    height: 1,
    marginLeft: 59,
    backgroundColor: colors.border,
  },
  explainBand: {
    marginTop: 18,
    padding: 15,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.softMint,
  },
  explainIcon: {
    width: 39,
    height: 39,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  explainCopy: {
    flex: 1,
    marginLeft: 11,
  },
  explainTitle: {
    color: colors.ink,
    fontSize: 11.5,
    fontWeight: "900",
  },
  explainText: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 10.5,
    lineHeight: 15.5,
  },
  footerNote: {
    marginTop: 22,
    paddingHorizontal: 5,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  footerText: {
    flex: 1,
    marginLeft: 8,
    color: colors.muted,
    fontSize: 10.5,
    lineHeight: 15.5,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.985 }],
  },
});
