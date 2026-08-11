import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/authStore";
import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
  safeTrackSpacing as spacing,
} from "../../constants/safeTrackDesign";

export default function AdminProfileScreen() {
  const router = useRouter();
  const administrator = useAuthStore((state) => state.administrator);
  const logout = useAuthStore((state) => state.logout);

  const firstLetter =
    administrator?.fullName?.trim().charAt(0).toUpperCase() || "A";

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
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>ADMINISTRATOR PROFILE</Text>
        <Text style={styles.heading}>Account profile</Text>
        <Text style={styles.subtitle}>
          Authorized SafeTrack administrator account information.
        </Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{firstLetter}</Text>
          </View>

          <Text style={styles.name}>
            {administrator?.fullName || "Administrator"}
          </Text>

          <View style={styles.rolePill}>
            <Ionicons
              name="shield-checkmark-outline"
              size={15}
              color={colors.primaryDark}
            />
            <Text style={styles.roleText}>SYSTEM ADMINISTRATOR</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={19} color={colors.primary} />
            <Text style={styles.infoText}>
              {administrator?.email || "No email record"}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons
              name="lock-closed-outline"
              size={19}
              color={colors.primary}
            />
            <Text style={styles.infoText}>
              Authorized read-only administrative access
            </Text>
          </View>
        </View>

        <View style={styles.note}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={colors.primary}
          />
          <Text style={styles.noteText}>
            SafeTrack administrators review authorized system records. They do
            not alter historical location, safe-zone, or SOS records.
          </Text>
        </View>

        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="log-out-outline"
            size={20}
            color={colors.danger}
          />
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
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
    paddingTop: 22,
    paddingBottom: 120,
  },

  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
  },

  heading: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.7,
    marginTop: 5,
  },

  subtitle: {
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 6,
  },

  profileCard: {
    alignItems: "center",
    padding: 22,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    marginTop: 21,
    ...shadow.card,
  },

  avatar: {
    width: 74,
    height: 74,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },

  avatarText: {
    color: colors.white,
    fontSize: 29,
    fontWeight: "900",
  },

  name: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 13,
  },

  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.softMint,
    marginTop: 8,
  },

  roleText: {
    color: colors.primaryDark,
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginLeft: 5,
  },

  infoRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 15,
    marginTop: 15,
    borderTopWidth: 1,
    borderColor: colors.border,
  },

  infoText: {
    flex: 1,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginLeft: 9,
  },

  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.softMint,
    marginTop: 18,
  },

  noteText: {
    flex: 1,
    color: colors.primaryDark,
    fontSize: 11.5,
    lineHeight: 17,
    marginLeft: 8,
  },

  logoutButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.dangerSoft,
    marginTop: 22,
  },

  logoutText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "900",
    marginLeft: 7,
  },

  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
});