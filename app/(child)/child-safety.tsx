import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useChildMobileStore } from "../../store/childMobileStore";
import {
  childColors as colors,
  childRadius as radius,
  childSpacing as spacing,
} from "../../constants/childDesign";

function displayForStatus(status: string | undefined) {
  if (status === "inside") {
    return {
      icon: "shield-checkmark" as const,
      title: "Inside safe zone",
      kicker: "SAFE ZONE CONFIRMED",
      color: colors.brandDeep,
      background: colors.brandSoft,
    };
  }
  if (status === "outside") {
    return {
      icon: "navigate" as const,
      title: "Outside safe zone",
      kicker: "OUTSIDE ACTIVE ZONE",
      color: colors.warning,
      background: colors.warningSoft,
    };
  }
  if (status === "no_safe_zone") {
    return {
      icon: "shield-outline" as const,
      title: "No safe zone configured",
      kicker: "NO ACTIVE ZONE",
      color: colors.muted,
      background: colors.quiet,
    };
  }
  return {
    icon: "location-outline" as const,
    title: "Status unavailable",
    kicker: "LOCATION NEEDED",
    color: colors.muted,
    background: colors.quiet,
  };
}

function dateTime(value: string | null | undefined) {
  if (!value) return "No location update available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No location update available";
  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ChildSafetyScreen() {
  const safeZoneStatus = useChildMobileStore((state) => state.safeZoneStatus);
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
        <Text style={styles.eyebrow}>MY SAFETY</Text>
        <Text style={styles.title}>Safe-zone status</Text>
        <Text style={styles.subtitle}>
          A simple view of the safe-zone information available from your latest shared location.
        </Text>

        <View style={[styles.statusStage, { backgroundColor: display.background }]}>
          <View style={styles.statusHeader}>
            <Text style={[styles.statusKicker, { color: display.color }]}>{display.kicker}</Text>
            <Ionicons name={display.icon} size={28} color={display.color} />
          </View>
          <Text style={styles.statusTitle}>{display.title}</Text>
          <Text style={styles.statusMessage}>
            {safeZoneStatus?.message ?? "Share a location update to check your safe-zone status."}
          </Text>
          {safeZoneStatus?.zoneName ? (
            <View style={styles.zoneLine}>
              <Ionicons name="location-outline" size={17} color={display.color} />
              <Text style={[styles.zoneName, { color: display.color }]}>{safeZoneStatus.zoneName}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.sectionLabel}>STATUS DETAILS</Text>
        <View style={styles.details}>
          <InfoRow
            icon="time-outline"
            title="Latest location update"
            value={dateTime(safeZoneStatus?.latestLocationAt ?? latestLocation?.recordedAt)}
          />
          <View style={styles.divider} />
          <InfoRow
            icon="lock-closed-outline"
            title="Who manages safe zones"
            value="Only your linked Guardian can create or change safe zones."
          />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => void updateLocation()}
          disabled={isLoading}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
            isLoading && styles.disabled,
          ]}
        >
          <Ionicons name="navigate" size={20} color={colors.white} />
          <Text style={styles.primaryButtonText}>
            {isLoading ? "Sharing location..." : "Share location and check status"}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => void refresh()}
          disabled={isLoading}
          style={({ pressed }) => [styles.refreshLink, pressed && styles.pressed]}
        >
          <Ionicons name="refresh-outline" size={18} color={colors.brandDeep} />
          <Text style={styles.refreshText}>Refresh saved status</Text>
        </Pressable>

        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={18} color={colors.muted} />
          <Text style={styles.noteText}>
            Safe-zone status is based on the latest successfully shared device location and may not represent your exact current position.
          </Text>
        </View>
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
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={19} color={colors.brandDeep} />
      </View>
      <View style={styles.infoCopy}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: 28,
    paddingBottom: 116,
  },
  eyebrow: { color: colors.brand, fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  title: { color: colors.ink, fontSize: 31, fontWeight: "900", letterSpacing: -0.9, marginTop: 5 },
  subtitle: { color: colors.muted, fontSize: 13.5, lineHeight: 20, marginTop: 7 },
  statusStage: {
    minHeight: 226,
    marginTop: 24,
    padding: 22,
    borderRadius: radius.lg,
    justifyContent: "flex-end",
  },
  statusHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusKicker: { fontSize: 9.5, fontWeight: "900", letterSpacing: 1.1 },
  statusTitle: { color: colors.ink, fontSize: 26, fontWeight: "900", letterSpacing: -0.5, marginTop: 38 },
  statusMessage: { color: colors.text, fontSize: 12.5, lineHeight: 19, marginTop: 7, maxWidth: 360 },
  zoneLine: { flexDirection: "row", alignItems: "center", marginTop: 15 },
  zoneName: { fontSize: 12, fontWeight: "900", marginLeft: 6 },
  sectionLabel: { color: colors.muted, fontSize: 9.5, fontWeight: "900", letterSpacing: 1.2, marginTop: 25, marginBottom: 5 },
  details: { paddingVertical: 3 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 13 },
  infoIcon: {
    width: 39,
    height: 39,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandWash,
    marginRight: 11,
  },
  infoCopy: { flex: 1, paddingTop: 2 },
  infoTitle: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  infoValue: { color: colors.text, fontSize: 12.5, lineHeight: 18, fontWeight: "800", marginTop: 3 },
  divider: { height: 1, backgroundColor: colors.line, marginLeft: 50 },
  primaryButton: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.brandDeep,
    marginTop: 19,
    paddingHorizontal: 16,
  },
  primaryButtonText: { color: colors.white, fontSize: 13.5, fontWeight: "900", marginLeft: 8, textAlign: "center" },
  refreshLink: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 8 },
  refreshText: { color: colors.brandDeep, fontSize: 12.5, fontWeight: "900", marginLeft: 7 },
  note: { flexDirection: "row", alignItems: "flex-start", marginTop: 22, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.line },
  noteText: { flex: 1, color: colors.muted, fontSize: 10.5, lineHeight: 16, marginLeft: 8 },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.56 },
});
