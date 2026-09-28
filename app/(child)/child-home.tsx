import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useChildMobileStore } from "../../store/childMobileStore";
import {
  childColors as colors,
  childRadius as radius,
  childShadow as shadow,
  childSpacing as spacing,
} from "../../constants/childDesign";

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || "Child";
}

function timeLabel(value: string | null | undefined) {
  if (!value) return "Not shared yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not shared yet";
  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusDetails(status: string | undefined) {
  if (status === "inside") {
    return {
      title: "Inside safe zone",
      helper: "Your latest shared location is inside an active safe zone.",
      icon: "shield-checkmark-outline" as const,
      color: colors.brandDeep,
      background: colors.brandSoft,
    };
  }
  if (status === "outside") {
    return {
      title: "Outside safe zone",
      helper: "Your latest shared location is outside the active safe zone.",
      icon: "navigate-outline" as const,
      color: colors.warning,
      background: colors.warningSoft,
    };
  }
  if (status === "no_safe_zone") {
    return {
      title: "No safe zone configured",
      helper: "Your Guardian has not configured an active safe zone.",
      icon: "shield-outline" as const,
      color: colors.muted,
      background: colors.quiet,
    };
  }
  return {
    title: "Status unavailable",
    helper: "Share a location update to check your current safe-zone status.",
    icon: "location-outline" as const,
    color: colors.muted,
    background: colors.quiet,
  };
}

export default function ChildHomeScreen() {
  const router = useRouter();
  const context = useChildMobileStore((state) => state.context);
  const latestLocation = useChildMobileStore((state) => state.latestLocation);
  const safeZoneStatus = useChildMobileStore((state) => state.safeZoneStatus);
  const activeSos = useChildMobileStore((state) => state.activeSos);
  const isLoading = useChildMobileStore((state) => state.isLoading);
  const sendLocation = useChildMobileStore((state) => state.sendLocation);
  const refresh = useChildMobileStore((state) => state.refresh);

  if (!context) return null;

  const safety = statusDetails(safeZoneStatus?.status);
  const sharedAt = timeLabel(latestLocation?.recordedAt);

  const sendUpdate = async () => {
    try {
      await sendLocation();
      Alert.alert(
        "Location sent",
        "Your latest available location was saved and shared with the linked Guardian."
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
        <View style={styles.topbar}>
          <View>
            <Text style={styles.productLabel}>SAFETRACK CHILD</Text>
            <Text style={styles.title}>Hi, {firstName(context.childName)}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh SafeTrack status"
            onPress={() => void refresh()}
            style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
          >
            <Ionicons name="refresh-outline" size={20} color={colors.brandDeep} />
          </Pressable>
        </View>

        <View style={styles.connectionRow}>
          <View style={styles.connectedDot} />
          <Text style={styles.connectionText}>
            Connected to <Text style={styles.connectionName}>{context.guardianName}</Text>
          </Text>
          <Ionicons name="shield-checkmark" size={18} color={colors.brand} />
        </View>

        {activeSos?.status === "active" ? (
          <Pressable
            onPress={() => router.push("/(child)/child-sos" as never)}
            style={({ pressed }) => [styles.sosActive, pressed && styles.pressed]}
          >
            <View style={styles.sosActiveIcon}>
              <Ionicons name="warning" size={21} color={colors.danger} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.sosActiveTitle}>SOS is active</Text>
              <Text style={styles.sosActiveText}>
                Your Guardian has been notified. SafeTrack is waiting for acknowledgement.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.danger} />
          </Pressable>
        ) : null}

        <View style={styles.locationSurface}>
          <View style={styles.locationTopline}>
            <View style={styles.locationIcon}>
              <Ionicons name="location" size={25} color={colors.brandDeep} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.locationLabel}>MY LOCATION</Text>
              <Text style={styles.locationTitle}>Share where I am</Text>
            </View>
          </View>

          <View style={styles.locationMeta}>
            <View style={styles.locationMetaItem}>
              <Text style={styles.metaLabel}>LAST SHARED</Text>
              <Text style={styles.metaValue}>{sharedAt}</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.locationMetaItem}>
              <Text style={styles.metaLabel}>SOURCE</Text>
              <Text style={styles.metaValue} numberOfLines={1}>
                {latestLocation?.source ?? "No record"}
              </Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send latest location"
            onPress={() => void sendUpdate()}
            disabled={isLoading}
            style={({ pressed }) => [
              styles.shareButton,
              pressed && styles.shareButtonPressed,
              isLoading && styles.disabled,
            ]}
          >
            <Ionicons name="navigate" size={20} color={colors.white} />
            <Text style={styles.shareButtonText}>
              {isLoading ? "Sharing location..." : "Share latest location"}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>SAFETY RIGHT NOW</Text>
        <Pressable
          onPress={() => router.push("/(child)/child-safety" as never)}
          style={({ pressed }) => [styles.safetyRow, pressed && styles.pressed]}
        >
          <View style={[styles.statusMark, { backgroundColor: safety.background }]}>
            <Ionicons name={safety.icon} size={24} color={safety.color} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.safetyTitle}>{safety.title}</Text>
            <Text style={styles.safetyText} numberOfLines={2}>
              {safeZoneStatus?.zoneName
                ? `${safeZoneStatus.zoneName} · ${safeZoneStatus.message}`
                : safeZoneStatus?.message ?? safety.helper}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>

        <View style={styles.rule} />

        <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
        <View style={styles.actions}>
          <QuickAction
            label="Safety"
            icon="shield-checkmark-outline"
            onPress={() => router.push("/(child)/child-safety" as never)}
          />
          <QuickAction
            label="SOS help"
            icon="warning-outline"
            danger
            onPress={() => router.push("/(child)/child-sos" as never)}
          />
          <QuickAction
            label="Profile"
            icon="person-outline"
            onPress={() => router.push("/(child)/child-profile" as never)}
          />
        </View>

        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={18} color={colors.muted} />
          <Text style={styles.noteText}>
            SafeTrack shares available device information with your linked Guardian. It does not confirm that an emergency has occurred.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({
  label,
  icon,
  danger,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <View style={[styles.actionIcon, danger && styles.actionIconDanger]}>
        <Ionicons
          name={icon}
          size={24}
          color={danger ? colors.danger : colors.brandDeep}
        />
      </View>
      <Text style={[styles.actionText, danger && styles.actionTextDanger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: 22,
    paddingBottom: 116,
  },
  flex: { flex: 1 },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  productLabel: {
    color: colors.brand,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  title: {
    color: colors.ink,
    fontSize: 31,
    fontWeight: "900",
    letterSpacing: -0.9,
    marginTop: 4,
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  connectionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand,
    marginRight: 8,
  },
  connectionText: { flex: 1, color: colors.muted, fontSize: 12.5 },
  connectionName: { color: colors.text, fontWeight: "800" },
  sosActive: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: 16,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
  },
  sosActiveIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    marginRight: 11,
  },
  sosActiveTitle: { color: colors.dangerDeep, fontSize: 14, fontWeight: "900" },
  sosActiveText: { color: colors.dangerDeep, fontSize: 11, lineHeight: 16, marginTop: 2, opacity: 0.9 },
  locationSurface: {
    marginTop: 18,
    padding: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.lift,
  },
  locationTopline: { flexDirection: "row", alignItems: "center" },
  locationIcon: {
    width: 54,
    height: 54,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandSoft,
    marginRight: 13,
  },
  locationLabel: { color: colors.brandDeep, fontSize: 9.5, fontWeight: "900", letterSpacing: 1.1 },
  locationTitle: { color: colors.ink, fontSize: 20, fontWeight: "900", marginTop: 2 },
  locationMeta: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingVertical: 16,
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  locationMetaItem: { flex: 1 },
  metaDivider: { width: 1, backgroundColor: colors.line, marginHorizontal: 14 },
  metaLabel: { color: colors.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  metaValue: { color: colors.text, fontSize: 12.5, fontWeight: "800", marginTop: 3 },
  shareButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.brandDeep,
  },
  shareButtonPressed: { transform: [{ scale: 0.99 }], opacity: 0.88 },
  shareButtonText: { color: colors.white, fontSize: 14, fontWeight: "900", marginLeft: 8 },
  sectionLabel: {
    color: colors.muted,
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginTop: 25,
    marginBottom: 11,
  },
  safetyRow: { flexDirection: "row", alignItems: "center", minHeight: 68 },
  statusMark: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  safetyTitle: { color: colors.ink, fontSize: 15.5, fontWeight: "900" },
  safetyText: { color: colors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 3, paddingRight: 8 },
  rule: { height: 1, backgroundColor: colors.line, marginTop: 17 },
  actions: { flexDirection: "row", justifyContent: "space-between" },
  action: { width: "31%", alignItems: "center", paddingVertical: 5 },
  actionIcon: {
    width: 54,
    height: 54,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandWash,
  },
  actionIconDanger: { backgroundColor: colors.dangerSoft },
  actionText: { color: colors.text, fontSize: 11.5, fontWeight: "800", marginTop: 8 },
  actionTextDanger: { color: colors.dangerDeep },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 26,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  noteText: { flex: 1, color: colors.muted, fontSize: 10.5, lineHeight: 16, marginLeft: 8 },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.56 },
});
