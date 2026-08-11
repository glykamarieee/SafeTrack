
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useChildMobileStore } from "../../store/childMobileStore";
import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
  safeTrackSpacing as spacing,
} from "../../constants/safeTrackDesign";

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || "Child";
}

function timeLabel(value: string | null | undefined) {
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

function statusDetails(status: string | undefined) {
  if (status === "inside") {
    return {
      title: "Inside safe zone",
      icon: "shield-checkmark-outline" as const,
      color: colors.primary,
      background: colors.softMint,
    };
  }

  if (status === "outside") {
    return {
      title: "Outside safe zone",
      icon: "navigate-outline" as const,
      color: "#A56A18",
      background: "#FFF5E5",
    };
  }

  if (status === "no_safe_zone") {
    return {
      title: "No safe zone configured",
      icon: "shield-outline" as const,
      color: colors.muted,
      background: "#EDF2EF",
    };
  }

  return {
    title: "Location update unavailable",
    icon: "location-outline" as const,
    color: colors.muted,
    background: "#EDF2EF",
  };
}

export default function ChildHomeScreen() {
  const router = useRouter();
  const context = useChildMobileStore((state) => state.context);
  const latestLocation = useChildMobileStore((state) => state.latestLocation);
  const safeZoneStatus = useChildMobileStore(
    (state) => state.safeZoneStatus
  );
  const activeSos = useChildMobileStore((state) => state.activeSos);
  const isLoading = useChildMobileStore((state) => state.isLoading);
  const sendLocation = useChildMobileStore((state) => state.sendLocation);
  const refresh = useChildMobileStore((state) => state.refresh);

  if (!context) {
    return null;
  }

  const safety = statusDetails(safeZoneStatus?.status);

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
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>CHILD SAFETY DASHBOARD</Text>
            <Text style={styles.title}>Hello, {firstName(context.childName)}</Text>
            <Text style={styles.subtitle}>
              Connected to {context.guardianName}.
            </Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {firstName(context.childName).charAt(0).toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.guardianCard}>
          <View style={styles.guardianIcon}>
            <Ionicons name="people-outline" size={23} color={colors.primary} />
          </View>
          <View style={styles.guardianCopy}>
            <Text style={styles.guardianLabel}>LINKED GUARDIAN</Text>
            <Text style={styles.guardianName}>{context.guardianName}</Text>
            <Text style={styles.guardianInfo}>
              Latest location updates and SOS alerts are shared with this Guardian.
            </Text>
          </View>
          <Ionicons
            name="shield-checkmark-outline"
            size={23}
            color={colors.primary}
          />
        </View>

        <View style={styles.locationCard}>
          <View style={styles.locationIcon}>
            <Ionicons name="location-outline" size={28} color={colors.primary} />
          </View>
          <Text style={styles.locationTitle}>Latest available location</Text>
          <Text style={styles.locationDetail}>
            {timeLabel(latestLocation?.recordedAt)}
          </Text>
          <Text style={styles.locationSource}>
            Source: {latestLocation?.source ?? "No saved device update"}
          </Text>
        </View>

        <Pressable
          onPress={() => void sendUpdate()}
          disabled={isLoading}
          style={({ pressed }) => [
            styles.primaryButton,
            (pressed || isLoading) && styles.pressed,
            isLoading && styles.disabled,
          ]}
        >
          <Ionicons name="location-outline" size={21} color={colors.white} />
          <Text style={styles.primaryButtonText}>Send latest location</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/(child)/child-safety" as never)}
          style={({ pressed }) => [
            styles.safetyCard,
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.safetyIcon, { backgroundColor: safety.background }]}>
            <Ionicons name={safety.icon} size={26} color={safety.color} />
          </View>
          <View style={styles.safetyCopy}>
            <Text style={styles.safetyLabel}>SAFE-ZONE STATUS</Text>
            <Text style={styles.safetyTitle}>{safety.title}</Text>
            <Text style={styles.safetyText}>
              {safeZoneStatus?.zoneName
                ? `${safeZoneStatus.zoneName} · ${safeZoneStatus.message}`
                : safeZoneStatus?.message ??
                  "Send a location update to check safe-zone status."}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={21} color={colors.primaryDark} />
        </Pressable>

        {activeSos?.status === "active" ? (
          <Pressable
            onPress={() => router.push("/(child)/child-sos" as never)}
            style={({ pressed }) => [
              styles.activeSos,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="warning-outline" size={23} color={colors.danger} />
            <View style={styles.activeSosCopy}>
              <Text style={styles.activeSosTitle}>SOS alert is active</Text>
              <Text style={styles.activeSosText}>
                SafeTrack is waiting for Guardian acknowledgement.
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={19} color={colors.danger} />
          </Pressable>
        ) : null}

        <View style={styles.actionsHeader}>
          <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
          <Pressable
            onPress={() => void refresh()}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Ionicons name="refresh-outline" size={20} color={colors.primary} />
          </Pressable>
        </View>

        <View style={styles.quickActions}>
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
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={colors.muted}
          />
          <Text style={styles.noteText}>
            SafeTrack provides available safety-related records only. It does
            not confirm that an emergency has occurred.
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
      onPress={onPress}
      style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}
    >
      <View style={[styles.quickIcon, danger && styles.quickIconDanger]}>
        <Ionicons name={icon} size={25} color={danger ? colors.danger : colors.primary} />
      </View>
      <Text style={styles.quickText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.lg,
    paddingTop: 39,
    paddingBottom: 115,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 17,
  },
  headerCopy: { flex: 1, marginRight: 12 },
  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.9,
    marginTop: 5,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  avatarText: { color: colors.white, fontSize: 23, fontWeight: "900" },
  guardianCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    ...shadow.soft,
  },
  guardianIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
  },
  guardianCopy: { flex: 1, marginLeft: 10, marginRight: 8 },
  guardianLabel: {
    color: colors.primary,
    fontSize: 9.5,
    letterSpacing: 1,
    fontWeight: "900",
  },
  guardianName: { color: colors.ink, fontSize: 15, fontWeight: "900", marginTop: 2 },
  guardianInfo: { color: colors.muted, fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  locationCard: {
    alignItems: "center",
    padding: 22,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    marginTop: 15,
    ...shadow.card,
  },
  locationIcon: {
    width: 63,
    height: 63,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
  },
  locationTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 13,
  },
  locationDetail: { color: colors.primaryDark, fontSize: 13, fontWeight: "800", marginTop: 5 },
  locationSource: { color: colors.muted, fontSize: 10.5, marginTop: 3 },
  primaryButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    marginTop: 14,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "900",
    marginLeft: 8,
  },
  safetyCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    marginTop: 15,
    ...shadow.soft,
  },
  safetyIcon: { width: 50, height: 50, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  safetyCopy: { flex: 1, marginLeft: 11, marginRight: 8 },
  safetyLabel: { color: colors.muted, fontSize: 9.5, letterSpacing: 1, fontWeight: "900" },
  safetyTitle: { color: colors.ink, fontSize: 15, fontWeight: "900", marginTop: 2 },
  safetyText: { color: colors.muted, fontSize: 10.5, lineHeight: 15, marginTop: 3 },
  activeSos: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    marginTop: 14,
  },
  activeSosCopy: { flex: 1, marginLeft: 9, marginRight: 7 },
  activeSosTitle: { color: colors.danger, fontSize: 13, fontWeight: "900" },
  activeSosText: { color: colors.danger, opacity: 0.9, fontSize: 10.5, marginTop: 2 },
  actionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 22,
    marginBottom: 10,
  },
  sectionTitle: { color: colors.muted, fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  quickActions: { flexDirection: "row", justifyContent: "space-between" },
  quickAction: { width: "30%", alignItems: "center" },
  quickIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softMint,
  },
  quickIconDanger: { backgroundColor: colors.dangerSoft },
  quickText: { color: colors.ink, fontSize: 11, fontWeight: "800", marginTop: 7 },
  note: { flexDirection: "row", alignItems: "flex-start", marginTop: 23, paddingHorizontal: 4 },
  noteText: { flex: 1, color: colors.muted, fontSize: 10.5, lineHeight: 15, marginLeft: 7 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.58 },
});
