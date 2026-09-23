import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import { useSosStore } from "../../store/sosStore";

import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
  safeTrackSpacing as spacing,
} from "../../constants/safeTrackDesign";

export default function SafetyCenterScreen() {
  const router = useRouter();

  const guardian = useAuthStore((state) => state.guardian);
  const children = useAuthStore((state) => state.linkedChildren);

  const alerts = useSosStore((state) => state.alerts);
  const loadSos = useSosStore((state) => state.loadForChild);

  const child = children[0] ?? null;

  const trackingSource =
    child?.trackingSource ?? "smartwatch";

  const [activeZoneCount, setActiveZoneCount] = useState(0);
  const [loadingZones, setLoadingZones] = useState(true);

  const activeSosCount = alerts.filter(
    (alert) => alert.status === "active"
  ).length;

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
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("guardian_id", guardian.id)
        .eq("child_id", child.id)
        .eq("is_enabled", true);

      if (!error) {
        setActiveZoneCount(count ?? 0);
      }

      setLoadingZones(false);
    };

    void loadActiveSafeZones();
  }, [guardian?.id, child?.id]);

  const safeZoneDescription = loadingZones
    ? "Loading safe zones..."
    : activeZoneCount === 0
      ? "No active safe zones yet. Tap to add one."
      : `${activeZoneCount} active guardian-defined safe zone${
          activeZoneCount === 1 ? "" : "s"
        }.`;

  const sosDescription =
    activeSosCount > 0
      ? `${activeSosCount} active SOS alert${
          activeSosCount === 1 ? "" : "s"
        } requires acknowledgement.`
      : "No active SOS alert currently needs acknowledgement.";

  const openSafeZones = () => {
    router.push("/safe-zones" as Href);
  };

  const openSosAlerts = () => {
    router.push("/sos-alerts" as Href);
  };

  const openLocation = () => {
    router.push("/location" as Href);
  };

  return (
    <SafeAreaView
      style={styles.safe}
      edges={["top", "left", "right"]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>SAFETY CENTER</Text>

        <Text style={styles.heading}>
          Stay informed, not{"\n"}overwhelmed.
        </Text>

        <Text style={styles.subtitle}>
          Review safe-zone activity and notices that may need guardian
          attention.
          {trackingSource === "mobile"
            ? " Location monitoring uses the child's mobile device."
            : trackingSource === "both"
            ? " Location monitoring uses smartwatch and mobile sources."
            : " Location monitoring uses the child's smartwatch."}
        </Text>

        <Pressable
          onPress={openSosAlerts}
          style={({ pressed }) => [
            styles.activeSosCard,
            activeSosCount > 0 && styles.activeSosCardDanger,
            pressed && styles.pressed,
          ]}
        >
          <View
            style={[
              styles.alertIconBox,
              activeSosCount > 0 && styles.alertIconBoxDanger,
            ]}
          >
            <Ionicons
              name="warning-outline"
              size={23}
              color={colors.danger}
            />
          </View>

          <View style={styles.cardCopy}>
            <Text style={styles.primaryCardTitle}>
              {activeSosCount > 0
                ? "Active SOS alert"
                : "SOS alert status"}
            </Text>

            <Text style={styles.primaryCardText}>
              {activeSosCount > 0
                ? "Review and acknowledge the SOS alert from the child device."
                : "No SOS alert currently requires acknowledgement."}
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={21}
            color={activeSosCount > 0 ? colors.danger : colors.primaryDark}
          />
        </Pressable>

        <Text style={styles.sectionLabel}>MONITORING</Text>

        <Pressable
          onPress={openSafeZones}
          style={({ pressed }) => [
            styles.card,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.iconBox}>
            <Ionicons
              name="shield-checkmark-outline"
              size={24}
              color={colors.primary}
            />
          </View>

          <View style={styles.cardCopy}>
            <Text style={styles.cardTitle}>Safe zones</Text>

            <Text style={styles.cardDescription}>
              {safeZoneDescription}
            </Text>

            <Text style={styles.manageText}>
              Tap to manage safe zones
            </Text>
          </View>

          <View style={styles.rightArea}>
            <View style={styles.zoneCountPill}>
              <Text style={styles.zoneCountText}>
                {loadingZones ? "..." : `${activeZoneCount} active`}
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.primaryDark}
              style={styles.chevron}
            />
          </View>
        </Pressable>

        <Text style={styles.sectionLabel}>SAFETY NOTICES</Text>

        <Pressable
          onPress={openLocation}
          style={({ pressed }) => [
            styles.card,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.iconBox}>
            <Ionicons
              name="trending-up-outline"
              size={23}
              color={colors.primary}
            />
          </View>

          <View style={styles.cardCopy}>
            <Text style={styles.cardTitle}>
              Location-pattern review
            </Text>

            <Text style={styles.cardDescription}>
              {trackingSource === "mobile"
                ? "No possible unusual mobile-device location pattern is awaiting review."
                : trackingSource === "both"
                ? "No possible unusual smartwatch or mobile location pattern is awaiting review."
                : "No possible unusual smartwatch location pattern is awaiting review."}
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={21}
            color={colors.muted}
          />
        </Pressable>

        <Pressable
          onPress={openSosAlerts}
          style={({ pressed }) => [
            styles.card,
            styles.sosNoticeCard,
            activeSosCount > 0 && styles.sosNoticeCardActive,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.sosIconBox}>
            <Ionicons
              name="warning-outline"
              size={23}
              color={colors.danger}
            />
          </View>

          <View style={styles.cardCopy}>
            <Text style={styles.cardTitle}>SOS alerts</Text>

            <Text style={styles.cardDescription}>
              {sosDescription}
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={21}
            color={activeSosCount > 0 ? colors.danger : colors.muted}
          />
        </Pressable>

        <View style={styles.footerNote}>
          <Ionicons
            name="lock-closed-outline"
            size={20}
            color={colors.primary}
          />

          <Text style={styles.footerText}>
            SafeTrack presents available records for guardian review. It does
            not confirm a child&apos;s safety condition or an emergency.
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
    paddingHorizontal: spacing.lg,
    paddingTop: 34,
    paddingBottom: 105,
  },

  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.25,
  },

  heading: {
    color: colors.ink,
    fontSize: 31,
    lineHeight: 38,
    fontWeight: "900",
    letterSpacing: -1,
    marginTop: 9,
  },

  subtitle: {
    color: colors.muted,
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 12,
  },

  activeSosCard: {
    minHeight: 106,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 17,
    paddingVertical: 15,
    borderRadius: 25,
    backgroundColor: "#DDF7EA",
    marginTop: 30,
    ...shadow.card,
  },

  activeSosCardDanger: {
    backgroundColor: "#E5F8ED",
  },

  alertIconBox: {
    width: 56,
    height: 56,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF0F0",
  },

  alertIconBoxDanger: {
    backgroundColor: "#FFF0F0",
  },

  cardCopy: {
    flex: 1,
    marginLeft: 13,
    marginRight: 8,
  },

  primaryCardTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
  },

  primaryCardText: {
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 4,
  },

  sectionLabel: {
    color: colors.muted,
    fontSize: 10.5,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginTop: 31,
    marginBottom: 11,
  },

  card: {
    minHeight: 103,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 25,
    backgroundColor: colors.white,
    ...shadow.card,
  },

  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
  },

  sosIconBox: {
    width: 56,
    height: 56,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF0F0",
  },

  cardTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },

  cardDescription: {
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 4,
  },

  manageText: {
    color: colors.primaryDark,
    fontSize: 10.5,
    fontWeight: "900",
    marginTop: 5,
  },

  rightArea: {
    alignItems: "flex-end",
    justifyContent: "center",
  },

  zoneCountPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.softMint,
  },

  zoneCountText: {
    color: colors.primaryDark,
    fontSize: 10.5,
    fontWeight: "900",
  },

  chevron: {
    marginTop: 7,
  },

  sosNoticeCard: {
    marginTop: 17,
  },

  sosNoticeCardActive: {
    borderWidth: 1.2,
    borderColor: "#F0B7B7",
  },

  footerNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 7,
    marginTop: 31,
  },

  footerText: {
    flex: 1,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginLeft: 12,
  },

  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
});