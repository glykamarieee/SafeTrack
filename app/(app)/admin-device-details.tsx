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
  fetchAdminSmartwatchDeviceDetail,
  updateAdminSmartwatchDeviceStatus,
  type AccountStatus,
  type AdminSmartwatchDeviceDetail,
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

export default function AdminDeviceDetailsScreen() {
  const router = useRouter();
  const { deviceId } = useLocalSearchParams<{
    deviceId?: string;
  }>();

  const [detail, setDetail] =
    useState<AdminSmartwatchDeviceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    if (!deviceId) {
      setError("Smartwatch device ID is missing.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchAdminSmartwatchDeviceDetail(deviceId);
      setDetail(data);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to load smartwatch device details."
      );
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const changeStatus = () => {
    if (!detail) {
      return;
    }

    const nextStatus: AccountStatus = detail.isActive
      ? "inactive"
      : "active";

    Alert.alert(
      `${nextStatus === "active" ? "Activate" : "Deactivate"} smartwatch device?`,
      `${detail.watchId} will be marked as ${nextStatus}.`,
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
              await updateAdminSmartwatchDeviceStatus(
                detail.deviceId,
                nextStatus
              );

              setDetail((current) =>
                current
                  ? {
                      ...current,
                      isActive: nextStatus === "active",
                    }
                  : current
              );

              Alert.alert(
                "Device status saved",
                `${detail.watchId} is now ${nextStatus}.`
              );
            } catch (reason) {
              Alert.alert(
                "Smartwatch device update error",
                reason instanceof Error
                  ? reason.message
                  : "SafeTrack could not save the device status."
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
          <Text style={styles.loadingText}>Loading device details...</Text>
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

          <Text style={styles.errorTitle}>Unable to load device</Text>

          <Text style={styles.errorText}>
            {error || "Smartwatch details are unavailable."}
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

  const inactive = !detail.isActive;

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
          <Text style={styles.backText}>Smartwatch devices</Text>
        </Pressable>

        <Text style={styles.eyebrow}>SMARTWATCH DEVICE DETAILS</Text>
        <Text style={styles.heading}>{detail.watchId}</Text>
        <Text style={styles.subtitle}>
          Child-device linkage and approved device-status management.
        </Text>

        <View style={styles.deviceCard}>
          <View
            style={[
              styles.deviceIcon,
              inactive && styles.deviceIconInactive,
            ]}
          >
            <Ionicons
              name="watch-outline"
              size={29}
              color={inactive ? colors.muted : "#2875A8"}
            />
          </View>

          <View style={styles.deviceCopy}>
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
                {inactive ? "Inactive device" : "Active device"}
              </Text>
            </View>

            <Text style={styles.pairedText}>
              Paired: {formatDate(detail.pairedAt)}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>LINKED CHILD</Text>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons
              name="person-outline"
              size={19}
              color={colors.primary}
            />

            <View style={styles.infoCopy}>
              <Text style={styles.infoLabel}>Child</Text>
              <Text style={styles.infoValue}>{detail.childName}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons
              name="calendar-outline"
              size={19}
              color={colors.primary}
            />

            <View style={styles.infoCopy}>
              <Text style={styles.infoLabel}>Age and source</Text>
              <Text style={styles.infoValue}>
                {detail.age ? `${detail.age} years old · ` : ""}
                {detail.trackingSource || "Smartwatch"}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons
              name="time-outline"
              size={19}
              color={colors.primary}
            />

            <View style={styles.infoCopy}>
              <Text style={styles.infoLabel}>Latest available record</Text>
              <Text style={styles.infoValue}>
                {formatDate(detail.latestLocationAt)}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>LINKED GUARDIAN</Text>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons
              name="people-outline"
              size={19}
              color={colors.primary}
            />

            <View style={styles.infoCopy}>
              <Text style={styles.infoLabel}>Guardian</Text>
              <Text style={styles.infoValue}>{detail.guardianName}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons
              name="mail-outline"
              size={19}
              color={colors.primary}
            />

            <View style={styles.infoCopy}>
              <Text style={styles.infoLabel}>Email address</Text>
              <Text style={styles.infoValue}>
                {detail.guardianEmail}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons
              name="shield-checkmark-outline"
              size={19}
              color={colors.primary}
            />

            <View style={styles.infoCopy}>
              <Text style={styles.infoLabel}>Guardian account status</Text>
              <Text style={styles.infoValue}>
                {detail.guardianAccountStatus === "inactive"
                  ? "Inactive"
                  : "Active"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Ionicons
              name="shield-outline"
              size={20}
              color={colors.primary}
            />
            <Text style={styles.metricValue}>{detail.safeZoneCount}</Text>
            <Text style={styles.metricLabel}>Safe zones</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metric}>
            <Ionicons
              name="warning-outline"
              size={20}
              color={
                detail.activeSosAlerts > 0
                  ? colors.danger
                  : colors.primary
              }
            />
            <Text style={styles.metricValue}>
              {detail.activeSosAlerts}
            </Text>
            <Text style={styles.metricLabel}>Active SOS</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>DEVICE STATUS</Text>

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
                ? "Smartwatch device is inactive"
                : "Smartwatch device is active"}
            </Text>

            <Text style={styles.statusDescription}>
              {inactive
                ? "Inactive devices should not be used as an active SafeTrack child monitoring source."
                : "The device can be used as an active SafeTrack monitoring source."}
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
            {inactive
              ? "Activate smartwatch device"
              : "Deactivate smartwatch device"}
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

  deviceCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    marginTop: 20,
    ...shadow.soft,
  },

  deviceIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E9F4FC",
  },

  deviceIconInactive: {
    backgroundColor: "#EEF1F0",
  },

  deviceCopy: {
    flex: 1,
    marginLeft: 12,
  },

  statusPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.softMint,
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

  pairedText: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 8,
  },

  sectionTitle: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginTop: 20,
    marginBottom: 9,
  },

  infoCard: {
    padding: 15,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    ...shadow.soft,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },

  infoCopy: {
    flex: 1,
    marginLeft: 9,
  },

  infoLabel: {
    color: colors.muted,
    fontSize: 9.5,
    fontWeight: "800",
  },

  infoValue: {
    color: colors.ink,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: "800",
    marginTop: 2,
  },

  metrics: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    marginTop: 11,
    ...shadow.soft,
  },

  metric: {
    flex: 1,
    alignItems: "center",
  },

  metricDivider: {
    width: 1,
    backgroundColor: colors.border,
  },

  metricValue: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 5,
  },

  metricLabel: {
    color: colors.muted,
    fontSize: 10.5,
    fontWeight: "800",
    marginTop: 2,
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