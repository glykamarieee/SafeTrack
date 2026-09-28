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
  childSpacing as spacing,
} from "../../constants/childDesign";

function sourceLabel(source: string) {
  const normalized = source.trim().toLowerCase();
  if (normalized === "both") return "Smartwatch and child phone";
  if (normalized === "mobile") return "Child phone";
  return "Smartwatch";
}

export default function ChildProfileScreen() {
  const router = useRouter();
  const context = useChildMobileStore((state) => state.context);
  const disconnect = useChildMobileStore((state) => state.disconnect);
  const isLoading = useChildMobileStore((state) => state.isLoading);

  if (!context) return null;

  const removeLink = () => {
    Alert.alert(
      "Disconnect child phone?",
      "This removes Child Dashboard access from this phone. The Guardian must generate a new temporary code before this phone can connect again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            try {
              await disconnect(context.deviceId ?? undefined);
              router.replace("/(auth)/child-device-link" as never);
            } catch (error) {
              Alert.alert(
                "Unable to disconnect child phone",
                error instanceof Error
                  ? error.message
                  : "SafeTrack could not disconnect this child phone."
              );
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>MY SAFETRACK</Text>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>
          The child profile and connection details available on this linked phone.
        </Text>

        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{context.childName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.identityCopy}>
            <Text style={styles.name}>{context.childName}</Text>
            <View style={styles.linkLine}>
              <View style={styles.linkDot} />
              <Text style={styles.linkText}>
                {context.mobileDeviceActive ? "Child phone linked" : "Child phone inactive"}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>LINKED GUARDIAN</Text>
        <View style={styles.openList}>
          <Info icon="people-outline" label="Guardian name" value={context.guardianName ?? "Not available"} />
          <View style={styles.divider} />
          <Info icon="mail-outline" label="Guardian email" value={context.guardianEmail ?? "Not available"} />
        </View>

        <Text style={styles.sectionLabel}>THIS DEVICE</Text>
        <View style={styles.openList}>
          <Info icon="phone-portrait-outline" label="Tracking source" value={sourceLabel(context.trackingSource)} />
          <View style={styles.divider} />
          <Info
            icon="shield-checkmark-outline"
            label="Connection status"
            value={context.mobileDeviceActive ? "Active and linked" : "Inactive"}
          />
        </View>

        <View style={styles.scopeNote}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.brandDeep} />
          <View style={styles.flex}>
            <Text style={styles.scopeTitle}>Child access is intentionally limited</Text>
            <Text style={styles.scopeText}>
              This phone can send location updates, view basic safe-zone status, and use SOS. Guardian settings, reports, and historical records cannot be edited here.
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={removeLink}
          disabled={isLoading}
          style={({ pressed }) => [
            styles.disconnectButton,
            pressed && styles.pressed,
            isLoading && styles.disabled,
          ]}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.dangerDeep} />
          <Text style={styles.disconnectText}>Disconnect this child phone</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Info({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.info}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={20} color={colors.brandDeep} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.infoLabel}>{label}</Text>
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
  flex: { flex: 1 },
  eyebrow: { color: colors.brand, fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  title: { color: colors.ink, fontSize: 32, fontWeight: "900", letterSpacing: -0.9, marginTop: 4 },
  subtitle: { color: colors.muted, fontSize: 13.5, lineHeight: 20, marginTop: 7 },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 27,
    paddingBottom: 23,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandDeep,
    marginRight: 15,
  },
  avatarText: { color: colors.white, fontSize: 31, fontWeight: "900" },
  identityCopy: { flex: 1 },
  name: { color: colors.ink, fontSize: 23, fontWeight: "900" },
  linkLine: { flexDirection: "row", alignItems: "center", marginTop: 7 },
  linkDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand, marginRight: 7 },
  linkText: { color: colors.brandDeep, fontSize: 11.5, fontWeight: "800" },
  sectionLabel: { color: colors.muted, fontSize: 9.5, fontWeight: "900", letterSpacing: 1.2, marginTop: 25, marginBottom: 5 },
  openList: { paddingVertical: 2 },
  info: { flexDirection: "row", alignItems: "center", paddingVertical: 13 },
  infoIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandWash,
    marginRight: 12,
  },
  infoLabel: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  infoValue: { color: colors.text, fontSize: 13.5, fontWeight: "900", marginTop: 3 },
  divider: { height: 1, backgroundColor: colors.line, marginLeft: 54 },
  scopeNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 25,
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.brandWash,
  },
  scopeTitle: { color: colors.brandDeep, fontSize: 12.5, fontWeight: "900", marginLeft: 10 },
  scopeText: { color: colors.text, fontSize: 10.5, lineHeight: 16, marginLeft: 10, marginTop: 3 },
  disconnectButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#F0CACA",
    backgroundColor: colors.surface,
    marginTop: 22,
  },
  disconnectText: { color: colors.dangerDeep, fontSize: 13, fontWeight: "900", marginLeft: 8 },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.56 },
});
