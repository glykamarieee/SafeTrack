import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuthStore } from "../../store/authStore";
import {
  adminColors as colors,
  adminLayout,
  adminRadius as radius,
  adminShadow as shadow,
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
        {
          text: "Cancel",
          style: "cancel",
        },
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
    <SafeAreaView
      style={styles.safe}
      edges={["top", "left", "right"]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.page}>
          <View style={styles.pageHeader}>
            <View style={styles.headerAccent} />

            <Text style={styles.eyebrow}>
              ADMINISTRATOR IDENTITY
            </Text>

            <Text style={styles.title}>
              Admin workspace
            </Text>

            <Text style={styles.subtitle}>
              Review the authenticated SafeTrack administrator account,
              authorized system functions, and session controls.
            </Text>
          </View>

          <View
            style={[
              styles.contentGrid,
              wide && styles.contentGridWide,
            ]}
          >
            <View style={styles.identityPane}>
              <View style={styles.identityTopLine}>
                <View style={styles.identitySignal}>
                  <View style={styles.identitySignalDot} />

                  <Text style={styles.identitySignalText}>
                    AUTHENTICATED
                  </Text>
                </View>

                <Ionicons
                  name="shield-checkmark-outline"
                  size={22}
                  color={colors.primaryDark}
                />
              </View>

              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {initials}
                </Text>
              </View>

              <Text style={styles.name}>
                {administrator?.fullName || "Administrator"}
              </Text>

              <View style={styles.roleLine}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={16}
                  color={colors.primary}
                />

                <Text style={styles.roleText}>
                  System administrator
                </Text>
              </View>

              <View style={styles.emailBlock}>
                <Text style={styles.emailLabel}>
                  ACCOUNT EMAIL
                </Text>

                <Text style={styles.email}>
                  {administrator?.email || "No email record"}
                </Text>
              </View>

              <View style={styles.identityDivider} />

              <View style={styles.identityMeta}>
                <View style={styles.identityMetaItem}>
                  <Text style={styles.identityMetaLabel}>
                    ACCESS
                  </Text>

                  <Text style={styles.identityMetaValue}>
                    Administrator
                  </Text>
                </View>

                <View style={styles.identityMetaDivider} />

                <View style={styles.identityMetaItem}>
                  <Text style={styles.identityMetaLabel}>
                    SESSION
                  </Text>

                  <Text style={styles.identityMetaValue}>
                    Active
                  </Text>
                </View>
              </View>
            </View>

            <View
              style={[
                styles.sessionPane,
                wide && styles.sessionPaneWide,
                shadow.soft,
              ]}
            >
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionHeaderCopy}>
                  <Text style={styles.sectionEyebrow}>
                    ACCESS CONTEXT
                  </Text>

                  <Text style={styles.sectionTitle}>
                    Authorized administrator session
                  </Text>
                </View>

                <View style={styles.secureBadge}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={14}
                    color={colors.primaryDark}
                  />

                  <Text style={styles.secureBadgeText}>
                    SECURE
                  </Text>
                </View>
              </View>

              <Text style={styles.sectionDescription}>
                The interface exposes only the administrator actions already
                available in SafeTrack: Guardian-account status,
                smartwatch-device status, and report generation/export.
              </Text>

              <View style={styles.permissionList}>
                <PermissionLine
                  icon="people-outline"
                  eyebrow="ACCOUNT CONTROL"
                  text="Guardian account administration"
                  detail="Review registered Guardians and manage supported account status."
                />

                <PermissionLine
                  icon="watch-outline"
                  eyebrow="DEVICE CONTROL"
                  text="Smartwatch device administration"
                  detail="Review linked smartwatch devices and manage supported device status."
                />

                <PermissionLine
                  icon="document-text-outline"
                  eyebrow="REPORTING"
                  text="PDF and Excel report export"
                  detail="Generate authorized SafeTrack activity reports from stored records."
                  last
                />
              </View>

              <View style={styles.boundaryNote}>
                <View style={styles.boundaryIcon}>
                  <Ionicons
                    name="information-circle-outline"
                    size={18}
                    color={colors.primaryDark}
                  />
                </View>

                <View style={styles.boundaryCopy}>
                  <Text style={styles.boundaryTitle}>
                    Administrator boundary
                  </Text>

                  <Text style={styles.boundaryText}>
                    Historical location, geofence, SOS, and daily activity
                    records are not edited from administrator controls.
                  </Text>
                </View>
              </View>

              <View style={styles.sessionFooter}>
                <View style={styles.sessionStatus}>
                  <View style={styles.sessionStatusDot} />

                  <View>
                    <Text style={styles.sessionStatusLabel}>
                      CURRENT SESSION
                    </Text>

                    <Text style={styles.sessionStatusValue}>
                      Administrator access active
                    </Text>
                  </View>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Log out of administrator session"
                  onPress={handleLogout}
                  style={({ pressed }) => [
                    styles.logoutButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name="log-out-outline"
                    size={18}
                    color={colors.danger}
                  />

                  <Text style={styles.logoutText}>
                    Log out
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PermissionLine({
  icon,
  eyebrow,
  text,
  detail,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  eyebrow: string;
  text: string;
  detail: string;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.permissionLine,
        !last && styles.permissionDivider,
      ]}
    >
      <View style={styles.permissionIcon}>
        <Ionicons
          name={icon}
          size={18}
          color={colors.primary}
        />
      </View>

      <View style={styles.permissionCopy}>
        <Text style={styles.permissionEyebrow}>
          {eyebrow}
        </Text>

        <Text style={styles.permissionText}>
          {text}
        </Text>

        <Text style={styles.permissionDetail}>
          {detail}
        </Text>
      </View>

      <Ionicons
        name="checkmark-circle"
        size={19}
        color={colors.primaryBright}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },

  scrollContent: {
    paddingBottom: 118,
  },

  page: {
    width: "100%",
    maxWidth: adminLayout.pageMax,
    alignSelf: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: 30,
  },

  pageHeader: {
    position: "relative",
    maxWidth: 760,
    paddingLeft: 18,
  },

  headerAccent: {
    position: "absolute",
    left: 0,
    top: 3,
    bottom: 3,
    width: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryBright,
  },

  eyebrow: {
    color: colors.primaryBright,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.6,
  },

  title: {
    color: colors.ink,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    letterSpacing: -1,
    marginTop: 6,
  },

  subtitle: {
    color: colors.text,
    fontSize: 13.5,
    lineHeight: 21,
    marginTop: 9,
    maxWidth: 700,
  },

  contentGrid: {
    marginTop: 28,
    gap: 18,
  },

  contentGridWide: {
    flexDirection: "row",
    alignItems: "stretch",
  },

  identityPane: {
    flex: 0.82,
    minWidth: 0,
    backgroundColor: colors.mint,
    borderWidth: 1,
    borderColor: "#CDE2D7",
    borderRadius: radius.xl,
    padding: 24,
  },

  identityTopLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  identitySignal: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  identitySignalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primaryBright,
  },

  identitySignalText: {
    color: colors.primaryDark,
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 1.3,
  },

  avatar: {
    width: 86,
    height: 86,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "#BEDDCF",
    marginTop: 28,
  },

  avatarText: {
    color: colors.primaryDark,
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: -0.6,
  },

  name: {
    color: colors.ink,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: "800",
    letterSpacing: -0.45,
    marginTop: 18,
  },

  roleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 8,
  },

  roleText: {
    color: colors.primaryDark,
    fontSize: 11.5,
    fontWeight: "800",
  },

  emailBlock: {
    marginTop: 24,
  },

  emailLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  email: {
    color: colors.text,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 5,
  },

  identityDivider: {
    height: 1,
    backgroundColor: "#C9DED4",
    marginVertical: 22,
  },

  identityMeta: {
    flexDirection: "row",
    alignItems: "stretch",
  },

  identityMetaItem: {
    flex: 1,
    minWidth: 0,
  },

  identityMetaDivider: {
    width: 1,
    backgroundColor: "#C9DED4",
    marginHorizontal: 16,
  },

  identityMetaLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.1,
  },

  identityMetaValue: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 5,
  },

  sessionPane: {
    flex: 1.3,
    minWidth: 0,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 24,
  },

  sessionPaneWide: {
    paddingLeft: 24,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },

  sectionHeaderCopy: {
    flex: 1,
    minWidth: 220,
  },

  sectionEyebrow: {
    color: colors.primaryBright,
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 1.25,
  },

  sectionTitle: {
    color: colors.ink,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "800",
    letterSpacing: -0.45,
    marginTop: 5,
  },

  secureBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: "#CDE3D8",
    borderRadius: radius.pill,
    minHeight: 30,
    paddingHorizontal: 10,
  },

  secureBadgeText: {
    color: colors.primaryDark,
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 1.1,
  },

  sectionDescription: {
    color: colors.text,
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: 10,
    maxWidth: 760,
  },

  permissionList: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surfaceRaised,
    marginTop: 20,
  },

  permissionLine: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 15,
    paddingVertical: 13,
  },

  permissionDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  permissionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },

  permissionCopy: {
    flex: 1,
    minWidth: 0,
  },

  permissionEyebrow: {
    color: colors.muted,
    fontSize: 8.5,
    fontWeight: "900",
    letterSpacing: 1.1,
  },

  permissionText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 3,
  },

  permissionDetail: {
    color: colors.text,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },

  boundaryNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#CCE3D8",
    padding: 15,
    marginTop: 18,
  },

  boundaryIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },

  boundaryCopy: {
    flex: 1,
  },

  boundaryTitle: {
    color: colors.ink,
    fontSize: 11.5,
    fontWeight: "800",
  },

  boundaryText: {
    color: colors.text,
    fontSize: 11.2,
    lineHeight: 17,
    marginTop: 3,
  },

  sessionFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
    marginTop: 20,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  sessionStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  sessionStatusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primaryBright,
  },

  sessionStatusLabel: {
    color: colors.muted,
    fontSize: 8.5,
    fontWeight: "900",
    letterSpacing: 1.1,
  },

  sessionStatusValue: {
    color: colors.ink,
    fontSize: 11.5,
    fontWeight: "700",
    marginTop: 2,
  },

  logoutButton: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#F0C8CB",
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    backgroundColor: colors.dangerSoft,
  },

  logoutText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
  },

  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
});