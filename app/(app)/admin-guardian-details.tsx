import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  fetchAdminGuardianDetail,
  updateAdminGuardianAccountStatus,
  subscribeAdminUpdates,
  type AccountStatus,
  type AdminGuardianDetail,
} from "../../services/adminService";
import {
  safeTrackColors as colors,
  safeTrackRadius as radius,
  safeTrackShadow as shadow,
  safeTrackSpacing as spacing,
} from "../../constants/safeTrackDesign";

function formatDate(value: string | null) {
  if (!value) {
    return "No stored record";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No stored record";
  }

  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminGuardianDetailsScreen() {
  const router = useRouter();
  const { guardianId } = useLocalSearchParams<{
    guardianId?: string;
  }>();

  const [detail, setDetail] = useState<AdminGuardianDetail | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    if (!guardianId) {
      setError("Guardian account ID is missing.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchAdminGuardianDetail(guardianId);
      setDetail(data);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to load Guardian account details."
      );
    } finally {
      setLoading(false);
    }
  }, [guardianId]);

useEffect(() => {

  void loadDetail();


  const unsubscribe =
    subscribeAdminUpdates(() => {

      void loadDetail();

    });


  return unsubscribe;


}, [loadDetail]);

  const changeStatus = () => {
    if (!detail) {
      return;
    }

    const nextStatus: AccountStatus =
      detail.accountStatus === "active" ? "inactive" : "active";

    Alert.alert(
      `${nextStatus === "active" ? "Activate" : "Deactivate"} account?`,
      `${detail.fullName} will be marked as ${nextStatus}.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: nextStatus === "active" ? "Activate" : "Deactivate",
          style: nextStatus === "inactive" ? "destructive" : "default",
          onPress: async () => {
            setSaving(true);

            try {
              await updateAdminGuardianAccountStatus(
                detail.guardianId,
                nextStatus
              );

              setDetail((current) =>
                current
                  ? {
                      ...current,
                      accountStatus: nextStatus,
                    }
                  : current
              );

              Alert.alert(
                "Account status saved",
                `${detail.fullName} is now ${nextStatus}.`
              );
            } catch (reason) {
              Alert.alert(
                "Guardian account update error",
                reason instanceof Error
                  ? reason.message
                  : "SafeTrack could not save the account status."
              );
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading Guardian details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !detail) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Ionicons
            name="alert-circle-outline"
            size={34}
            color={colors.danger}
          />
          <Text style={styles.errorTitle}>Unable to load account</Text>
          <Text style={styles.errorText}>
            {error || "Guardian account details are unavailable."}
          </Text>

          <Pressable
            onPress={() => void loadDetail()}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const inactive = detail.accountStatus === "inactive";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="arrow-back"
            size={20}
            color={colors.primaryDark}
          />
          <Text style={styles.backText}>Guardian accounts</Text>
        </Pressable>

        <Text style={styles.eyebrow}>GUARDIAN ACCOUNT DETAILS</Text>
        <Text style={styles.heading}>{detail.fullName}</Text>
        <Text style={styles.subtitle}>
          Authorized record view and account-status management.
        </Text>

        <View style={styles.profileCard}>
          <View
            style={[
              styles.avatar,
              inactive && styles.avatarInactive,
            ]}
          >
            <Text style={styles.avatarText}>
              {detail.fullName.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={styles.profileCopy}>
            <Text style={styles.email}>{detail.email}</Text>

            <View
              style={[
                styles.statusPill,
                inactive && styles.statusPillInactive,
              ]}
            >
              <Ionicons
                name={
                  inactive
                    ? "pause-circle-outline"
                    : "checkmark-circle-outline"
                }
                size={15}
                color={inactive ? colors.muted : colors.primaryDark}
              />

              <Text
                style={[
                  styles.statusText,
                  inactive && styles.statusTextInactive,
                ]}
              >
                {inactive ? "Inactive account" : "Active account"}
              </Text>
            </View>

            <Text style={styles.dateText}>
              Registered {formatDate(detail.createdAt)}
            </Text>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Ionicons
              name="people-outline"
              size={20}
              color={colors.primary}
            />
            <Text style={styles.summaryValue}>
              {detail.registeredChildren}
            </Text>
            <Text style={styles.summaryLabel}>Children</Text>
          </View>

          <View style={styles.summaryCard}>
            <Ionicons
              name="watch-outline"
              size={20}
              color="#2875A8"
            />
            <Text style={styles.summaryValue}>{detail.activeDevices}</Text>
            <Text style={styles.summaryLabel}>Active devices</Text>
          </View>

          <View style={styles.summaryCard}>
            <Ionicons
              name="shield-outline"
              size={20}
              color={colors.primary}
            />
            <Text style={styles.summaryValue}>
              {detail.activeSafeZones}
            </Text>
            <Text style={styles.summaryLabel}>Safe zones</Text>
          </View>

          <View style={styles.summaryCard}>
            <Ionicons
              name="warning-outline"
              size={20}
              color={
                detail.activeSosAlerts > 0
                  ? colors.danger
                  : colors.primary
              }
            />
            <Text style={styles.summaryValue}>
              {detail.activeSosAlerts}
            </Text>
            <Text style={styles.summaryLabel}>Active SOS</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>REGISTERED CHILDREN</Text>

        {detail.children.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="person-add-outline"
              size={28}
              color={colors.primary}
            />
            <Text style={styles.emptyTitle}>No child profile registered</Text>
            <Text style={styles.emptyText}>
              This Guardian does not currently have a linked child profile.
            </Text>
          </View>
        ) : (
          detail.children.map((child) => (
            <View key={child.childId} style={styles.childCard}>
              <View style={styles.childAvatar}>
                <Text style={styles.childAvatarText}>
                  {child.fullName.charAt(0).toUpperCase()}
                </Text>
              </View>

              <View style={styles.childCopy}>
                <Text style={styles.childName}>{child.fullName}</Text>

                <Text style={styles.childDetail}>
                  {child.age ? `${child.age} years old · ` : ""}
                  {child.relationship || "Guardian"}
                </Text>

                <Text style={styles.childMeta}>
                  {child.activeDeviceCount} active device
                  {child.activeDeviceCount === 1 ? "" : "s"} ·{" "}
                  {child.safeZoneCount} safe zone
                  {child.safeZoneCount === 1 ? "" : "s"}
                </Text>

                <Text style={styles.childLocation}>
                  Latest: {formatDate(child.latestLocationAt)}
                </Text>
              </View>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>ACCOUNT STATUS</Text>

        <View style={styles.statusCard}>
          <Ionicons
            name={
              inactive
                ? "pause-circle-outline"
                : "checkmark-circle-outline"
            }
            size={23}
            color={inactive ? colors.muted : colors.primary}
          />

          <View style={styles.statusCopy}>
            <Text style={styles.statusTitle}>
              {inactive
                ? "Guardian account is inactive"
                : "Guardian account is active"}
            </Text>

            <Text style={styles.statusDescription}>
              {inactive
                ? "Inactive accounts should not be used for Guardian monitoring until reactivated."
                : "The Guardian can use approved SafeTrack monitoring features."}
            </Text>
          </View>
        </View>

        <Pressable
          disabled={saving}
          onPress={changeStatus}
          style={({ pressed }) => [
            styles.updateButton,
            inactive && styles.activateButton,
            (pressed || saving) && styles.pressed,
            saving && styles.disabled,
          ]}
        >
          {saving ? (
            <ActivityIndicator
              size="small"
              color={inactive ? colors.primaryDark : colors.white}
            />
          ) : (
            <Ionicons
              name={
                inactive
                  ? "checkmark-circle-outline"
                  : "pause-circle-outline"
              }
              size={20}
              color={inactive ? colors.primaryDark : colors.white}
            />
          )}

          <Text
            style={[
              styles.updateButtonText,
              inactive && styles.activateButtonText,
            ]}
          >
            {inactive ? "Activate Guardian account" : "Deactivate Guardian account"}
          </Text>
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
    paddingTop: 18,
    paddingBottom: 120,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  loadingText: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 10,
  },

  errorTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 10,
  },

  errorText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 5,
  },

  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: radius.pill,
    backgroundColor: colors.softMint,
    marginTop: 16,
  },

  retryText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "900",
  },

  backButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
  },

  backText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "900",
    marginLeft: 6,
  },

  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
    marginTop: 16,
  },

  heading: {
    color: colors.ink,
    fontSize: 27,
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
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    marginTop: 20,
    ...shadow.soft,
  },

  avatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },

  avatarInactive: {
    backgroundColor: colors.muted,
  },

  avatarText: {
    color: colors.white,
    fontSize: 23,
    fontWeight: "900",
  },

  profileCopy: {
    flex: 1,
    marginLeft: 12,
  },

  email: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
  },

  statusPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.softMint,
    marginTop: 7,
  },

  statusPillInactive: {
    backgroundColor: "#F1EEEE",
  },

  statusText: {
    color: colors.primaryDark,
    fontSize: 9.5,
    fontWeight: "900",
    marginLeft: 4,
  },

  statusTextInactive: {
    color: colors.muted,
  },

  dateText: {
    color: colors.muted,
    fontSize: 9.5,
    marginTop: 7,
  },

  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 12,
  },

  summaryCard: {
    width: "48.5%",
    minHeight: 108,
    padding: 13,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    marginBottom: 10,
    ...shadow.soft,
  },

  summaryValue: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 12,
  },

  summaryLabel: {
    color: colors.muted,
    fontSize: 10.5,
    fontWeight: "800",
    marginTop: 3,
  },

  sectionTitle: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginTop: 14,
    marginBottom: 9,
  },

  emptyCard: {
    alignItems: "center",
    padding: 27,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    ...shadow.soft,
  },

  emptyTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
    marginTop: 8,
  },

  emptyText: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 4,
  },

  childCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 13,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    marginBottom: 10,
    ...shadow.soft,
  },

  childAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.sage,
  },

  childAvatarText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "900",
  },

  childCopy: {
    flex: 1,
    marginLeft: 10,
  },

  childName: {
    color: colors.ink,
    fontSize: 13.5,
    fontWeight: "900",
  },

  childDetail: {
    color: colors.muted,
    fontSize: 10.5,
    marginTop: 2,
  },

  childMeta: {
    color: colors.primaryDark,
    fontSize: 10.2,
    fontWeight: "800",
    marginTop: 6,
  },

  childLocation: {
    color: colors.muted,
    fontSize: 9.5,
    marginTop: 4,
  },

  statusCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    ...shadow.soft,
  },

  statusCopy: {
    flex: 1,
    marginLeft: 10,
  },

  statusTitle: {
    color: colors.ink,
    fontSize: 13.5,
    fontWeight: "900",
  },

  statusDescription: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },

  updateButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    marginTop: 13,
  },

  activateButton: {
    backgroundColor: colors.softMint,
  },

  updateButtonText: {
    color: colors.white,
    fontSize: 12.5,
    fontWeight: "900",
    marginLeft: 7,
  },

  activateButtonText: {
    color: colors.primaryDark,
  },

  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },

  disabled: {
    opacity: 0.58,
  },
});