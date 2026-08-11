
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useChildMobileStore } from "../../store/childMobileStore";
import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
  safeTrackSpacing as spacing,
} from "../../constants/safeTrackDesign";

function displayForStatus(status: string | undefined) {
  if (status === "inside") {
    return {
      icon: "shield-checkmark-outline" as const,
      title: "Inside safe zone",
      color: colors.primary,
      background: colors.softMint,
    };
  }

  if (status === "outside") {
    return {
      icon: "navigate-outline" as const,
      title: "Outside safe zone",
      color: "#A56A18",
      background: "#FFF5E5",
    };
  }

  if (status === "no_safe_zone") {
    return {
      icon: "shield-outline" as const,
      title: "No safe zone configured",
      color: colors.muted,
      background: "#EEF2F0",
    };
  }

  return {
    icon: "location-outline" as const,
    title: "Location update unavailable",
    color: colors.muted,
    background: "#EEF2F0",
  };
}

function dateTime(value: string | null | undefined) {
  if (!value) {
    return "No location update available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No location update available";
  }

  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ChildSafetyScreen() {
  const safeZoneStatus = useChildMobileStore(
    (state) => state.safeZoneStatus
  );
  const latestLocation = useChildMobileStore((state) => state.latestLocation);
  const sendLocation = useChildMobileStore((state) => state.sendLocation);
  const refresh = useChildMobileStore((state) => state.refresh);
  const isLoading = useChildMobileStore((state) => state.isLoading);

  const display = displayForStatus(safeZoneStatus?.status);

  const updateLocation = async () => {
    try {
      await sendLocation();
      Alert.alert(
        "Location sent",
        "SafeTrack checked your basic safe-zone status using the latest available location."
      );
    } catch (error) {
      Alert.alert(
        "Location update unavailable",
        error instanceof Error
          ? error.message
          : "SafeTrack could not send the latest location."
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>SAFETY STATUS</Text>
        <Text style={styles.title}>Safe-zone status</Text>
        <Text style={styles.subtitle}>
          This screen shows basic available safe-zone information only.
        </Text>

        <View style={styles.mainCard}>
          <View style={[styles.statusIcon, { backgroundColor: display.background }]}>
            <Ionicons name={display.icon} size={37} color={display.color} />
          </View>
          <Text style={styles.statusTitle}>{display.title}</Text>
          <Text style={styles.statusText}>
            {safeZoneStatus?.message ??
              "Send a location update to check your safe-zone status."}
          </Text>

          {safeZoneStatus?.zoneName ? (
            <View style={styles.zonePill}>
              <Ionicons name="location-outline" size={16} color={colors.primaryDark} />
              <Text style={styles.zoneText}>
                Safe zone: {safeZoneStatus.zoneName}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.detailsCard}>
          <InfoRow
            icon="time-outline"
            title="Latest location update"
            value={dateTime(safeZoneStatus?.latestLocationAt ?? latestLocation?.recordedAt)}
          />
          <View style={styles.divider} />
          <InfoRow
            icon="lock-closed-outline"
            title="Child access"
            value="Safe zones can only be created or changed by the linked Guardian."
          />
        </View>

        <Pressable
          onPress={() => void updateLocation()}
          disabled={isLoading}
          style={({ pressed }) => [
            styles.primaryButton,
            (pressed || isLoading) && styles.pressed,
            isLoading && styles.disabled,
          ]}
        >
          <Ionicons name="location-outline" size={20} color={colors.white} />
          <Text style={styles.primaryButtonText}>Send latest location</Text>
        </Pressable>

        <Pressable
          onPress={() => void refresh()}
          disabled={isLoading}
          style={({ pressed }) => [
            styles.secondaryButton,
            (pressed || isLoading) && styles.pressed,
            isLoading && styles.disabled,
          ]}
        >
          <Ionicons name="refresh-outline" size={19} color={colors.primaryDark} />
          <Text style={styles.secondaryButtonText}>Refresh status</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  title,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <View style={styles.infoCopy}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: 40, paddingBottom: 115 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: "900", letterSpacing: 1.3 },
  title: { color: colors.ink, fontSize: 30, fontWeight: "900", letterSpacing: -0.9, marginTop: 5 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 6 },
  mainCard: {
    alignItems: "center",
    padding: 25,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    marginTop: 23,
    ...shadow.card,
  },
  statusIcon: { width: 79, height: 79, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  statusTitle: { color: colors.ink, fontSize: 21, fontWeight: "900", marginTop: 15 },
  statusText: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 6 },
  zonePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.softMint,
    marginTop: 14,
  },
  zoneText: { color: colors.primaryDark, fontSize: 11, fontWeight: "900", marginLeft: 6 },
  detailsCard: {
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    marginTop: 15,
    ...shadow.soft,
  },
  infoRow: { flexDirection: "row", alignItems: "flex-start" },
  infoCopy: { flex: 1, marginLeft: 9 },
  infoTitle: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  infoValue: { color: colors.ink, fontSize: 12, lineHeight: 17, fontWeight: "800", marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
  primaryButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    marginTop: 17,
  },
  primaryButtonText: { color: colors.white, fontSize: 14, fontWeight: "900", marginLeft: 8 },
  secondaryButton: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.softMint,
    marginTop: 10,
  },
  secondaryButtonText: { color: colors.primaryDark, fontSize: 13, fontWeight: "900", marginLeft: 7 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.58 },
});
