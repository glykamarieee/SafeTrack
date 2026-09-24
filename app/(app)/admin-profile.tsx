import { Alert, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuthStore } from "../../store/authStore";
import {
  adminColors as colors,
  adminLayout,
  adminRadius as radius,
  adminSpacing as spacing,
} from "../../constants/adminDesign";

export default function AdminProfileScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const administrator = useAuthStore((state) => state.administrator);
  const logout = useAuthStore((state) => state.logout);

  const initials =
    administrator?.fullName
      ?.trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "A";

  const handleLogout = () => {
    Alert.alert(
      "Log out?",
      "You will be signed out of the SafeTrack Administrator Module.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log out",
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/(auth)/login");
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.page}>
          <Text style={styles.eyebrow}>ADMINISTRATOR</Text>
          <Text style={styles.title}>Account</Text>
          <Text style={styles.subtitle}>Your authenticated SafeTrack administrator identity and session controls.</Text>

          <View style={[styles.contentGrid, wide && styles.contentGridWide]}>
            <View style={styles.identityPane}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
              <Text style={styles.name}>{administrator?.fullName || "Administrator"}</Text>
              <View style={styles.roleLine}>
                <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
                <Text style={styles.roleText}>System administrator</Text>
              </View>
              <Text style={styles.email}>{administrator?.email || "No email record"}</Text>
            </View>

            <View style={[styles.sessionPane, wide && styles.sessionPaneWide]}>
              <Text style={styles.sectionEyebrow}>ACCESS CONTEXT</Text>
              <Text style={styles.sectionTitle}>Authorized administrator session</Text>
              <Text style={styles.sectionDescription}>
                The interface exposes only the administrator actions already available in SafeTrack: Guardian-account status, smartwatch-device status, and report generation/export.
              </Text>

              <View style={styles.permissionList}>
                <PermissionLine icon="people-outline" text="Guardian account administration" />
                <PermissionLine icon="watch-outline" text="Smartwatch device administration" />
                <PermissionLine icon="document-text-outline" text="PDF and Excel report export" />
              </View>

              <View style={styles.boundaryNote}>
                <Ionicons name="lock-closed-outline" size={17} color={colors.primaryDark} />
                <Text style={styles.boundaryText}>
                  Historical location, geofence, SOS, and daily activity records are not edited from administrator controls.
                </Text>
              </View>

              <Pressable onPress={handleLogout} style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}>
                <Ionicons name="log-out-outline" size={18} color={colors.danger} />
                <Text style={styles.logoutText}>Log out of administrator session</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PermissionLine({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.permissionLine}>
      <View style={styles.permissionIcon}><Ionicons name={icon} size={17} color={colors.primary} /></View>
      <Text style={styles.permissionText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 110 },
  page: { width: "100%", maxWidth: adminLayout.pageMax, alignSelf: "center", paddingHorizontal: spacing.xl, paddingTop: 28 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  title: { color: colors.ink, fontSize: 30, fontWeight: "800", letterSpacing: -0.75, marginTop: 5 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 7, maxWidth: 700 },
  contentGrid: { marginTop: 30, gap: 30 },
  contentGridWide: { flexDirection: "row", alignItems: "flex-start", gap: 44 },
  identityPane: { flex: 0.8, minWidth: 0 },
  sessionPane: { flex: 1.3, minWidth: 0 },
  sessionPaneWide: { borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: 38 },
  avatar: { width: 78, height: 78, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  avatarText: { color: colors.primaryDark, fontSize: 24, fontWeight: "900", letterSpacing: -0.4 },
  name: { color: colors.ink, fontSize: 21, fontWeight: "800", marginTop: 16 },
  roleLine: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 7 },
  roleText: { color: colors.primaryDark, fontSize: 11.5, fontWeight: "800" },
  email: { color: colors.muted, fontSize: 12, marginTop: 8 },
  sectionEyebrow: { color: colors.muted, fontSize: 9.5, fontWeight: "900", letterSpacing: 1.15 },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: "800", letterSpacing: -0.3, marginTop: 5 },
  sectionDescription: { color: colors.muted, fontSize: 12.5, lineHeight: 19, marginTop: 8 },
  permissionList: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, marginTop: 18 },
  permissionLine: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  permissionIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  permissionText: { flex: 1, color: colors.text, fontSize: 12.5, fontWeight: "700" },
  boundaryNote: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 13, marginTop: 18 },
  boundaryText: { flex: 1, color: colors.primaryDark, fontSize: 11.2, lineHeight: 17 },
  logoutButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginTop: 18, backgroundColor: colors.surface },
  logoutText: { color: colors.danger, fontSize: 12, fontWeight: "800" },
  pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
});
