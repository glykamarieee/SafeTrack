import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  fetchAdminSmartwatchDeviceDetail,
  updateAdminSmartwatchDeviceStatus,
  subscribeAdminUpdates,
  type AccountStatus,
  type AdminSmartwatchDeviceDetail,
} from "../../services/adminService";
import { AdminStatusPill } from "../../components/admin/AdminStatusPill";
import {
  adminColors as colors,
  adminLayout,
  adminRadius as radius,
  adminShadow as shadow,
  adminSpacing as spacing,
} from "../../constants/adminDesign";

function formatDate(value: string | null) {
  if (!value) return "No stored record";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No stored record";
  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function titleCaseSource(value: string | null) {
  if (!value) return "Not available";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function AdminDeviceDetailsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 980;
  const { deviceId } = useLocalSearchParams<{ deviceId?: string }>();

  const [detail, setDetail] = useState<AdminSmartwatchDeviceDetail | null>(null);
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
      setDetail(await fetchAdminSmartwatchDeviceDetail(deviceId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load smartwatch device details.");
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    void loadDetail();
    const unsubscribe = subscribeAdminUpdates(() => void loadDetail());
    return unsubscribe;
  }, [loadDetail]);

  const changeStatus = () => {
    if (!detail) return;
    const nextStatus: AccountStatus = detail.isActive ? "inactive" : "active";

    Alert.alert(
      `${nextStatus === "active" ? "Activate" : "Deactivate"} smartwatch device?`,
      `${detail.watchId} will be marked as ${nextStatus}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: nextStatus === "active" ? "Activate" : "Deactivate",
          style: nextStatus === "inactive" ? "destructive" : "default",
          onPress: async () => {
            setSaving(true);
            try {
              await updateAdminSmartwatchDeviceStatus(detail.deviceId, nextStatus);
              setDetail((current) => (current ? { ...current, isActive: nextStatus === "active" } : current));
              Alert.alert("Device status saved", `${detail.watchId} is now ${nextStatus}.`);
            } catch (reason) {
              Alert.alert(
                "Smartwatch device update error",
                reason instanceof Error ? reason.message : "SafeTrack could not save the device status.",
              );
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  if (loading || error || !detail) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <View style={[styles.stateIcon, error && styles.stateIconError]}>
            {loading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="alert-circle-outline" size={24} color={colors.danger} />
            )}
          </View>
          <Text style={styles.stateTitle}>{loading ? "Loading device details" : "Unable to load device"}</Text>
          {!loading ? <Text style={styles.stateText}>{error || "Smartwatch details are unavailable."}</Text> : null}
          {!loading ? (
            <Pressable onPress={() => void loadDetail()} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
              <Ionicons name="refresh-outline" size={16} color={colors.white} />
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  const inactive = !detail.isActive;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.page}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
            <Ionicons name="arrow-back" size={18} color={colors.primaryDark} />
            <Text style={styles.backText}>Smartwatch devices</Text>
          </Pressable>

          <View style={styles.identityHeader}>
            <View style={[styles.watchMark, inactive && styles.watchMarkInactive]}>
              <Ionicons name="watch-outline" size={28} color={inactive ? colors.muted : colors.blue} />
            </View>
            <View style={styles.identityCopy}>
              <Text style={styles.eyebrow}>SMARTWATCH DEVICE</Text>
              <View style={styles.nameLine}>
                <Text style={styles.watchId}>{detail.watchId}</Text>
                <AdminStatusPill label={inactive ? "Inactive" : "Active"} tone={inactive ? "inactive" : "active"} />
              </View>
              <Text style={styles.paired}>Paired {formatDate(detail.pairedAt)}</Text>
            </View>
          </View>

          <View style={styles.summaryRail}>
            <SummaryItem label="Safe zones" value={detail.safeZoneCount} icon="shield-outline" />
            <SummaryItem
              label="Active SOS"
              value={detail.activeSosAlerts}
              icon="alert-circle-outline"
              danger={detail.activeSosAlerts > 0}
            />
            <View style={styles.summaryTextItem}>
              <Ionicons name="location-outline" size={17} color={colors.blue} />
              <View style={styles.summaryTextCopy}>
                <Text style={styles.summaryTextValue} numberOfLines={1}>{formatDate(detail.latestLocationAt)}</Text>
                <Text style={styles.summaryLabel}>Latest stored location</Text>
              </View>
            </View>
          </View>

          <View style={[styles.detailGrid, wide && styles.detailGridWide]}>
            <View style={styles.infoColumn}>
              <Section title="Linked child" eyebrow="DEVICE OWNERSHIP">
                <InfoRow icon="person-outline" label="Child" value={detail.childName} />
                <InfoRow
                  icon="calendar-outline"
                  label="Age and tracking source"
                  value={`${detail.age !== null ? `${detail.age} years old` : "Age unavailable"} · ${titleCaseSource(detail.trackingSource)}`}
                />
                <InfoRow icon="location-outline" label="Latest stored location" value={formatDate(detail.latestLocationAt)} last />
              </Section>

              <Section title="Linked Guardian" eyebrow="AUTHORIZED ACCOUNT">
                <InfoRow icon="people-outline" label="Guardian" value={detail.guardianName} />
                <InfoRow icon="mail-outline" label="Email" value={detail.guardianEmail} />
                <InfoRow
                  icon="shield-checkmark-outline"
                  label="Guardian account status"
                  value={detail.guardianAccountStatus === "inactive" ? "Inactive" : "Active"}
                  last
                />
              </Section>
            </View>

            <View style={[styles.statusColumn, wide && styles.statusColumnWide]}>
              <Text style={styles.sectionEyebrow}>DEVICE CONTROL</Text>
              <Text style={styles.sectionTitle}>{inactive ? "Device inactive" : "Device active"}</Text>
              <Text style={styles.statusDescription}>
                {inactive
                  ? "This smartwatch is currently marked inactive in the existing SafeTrack device-status workflow."
                  : "This smartwatch is currently marked active in the existing SafeTrack device-status workflow."}
              </Text>

              <View style={styles.statusBoundary}>
                <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
                <Text style={styles.statusBoundaryText}>
                  This control uses the existing administrator device-status function only. It does not modify stored location, safe-zone, SOS, or activity history records.
                </Text>
              </View>

              <Pressable
                disabled={saving}
                onPress={changeStatus}
                style={({ pressed }) => [
                  styles.statusButton,
                  inactive ? styles.activateButton : styles.deactivateButton,
                  pressed && styles.pressed,
                  saving && styles.disabled,
                ]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={inactive ? colors.primaryDark : colors.white} />
                ) : (
                  <Ionicons name={inactive ? "play-outline" : "pause-outline"} size={18} color={inactive ? colors.primaryDark : colors.white} />
                )}
                <Text style={[styles.statusButtonText, inactive && styles.activateButtonText]}>
                  {inactive ? "Activate smartwatch device" : "Deactivate smartwatch device"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryItem({ label, value, icon, danger = false }: { label: string; value: number; icon: keyof typeof Ionicons.glyphMap; danger?: boolean }) {
  return (
    <View style={styles.summaryItem}>
      <Ionicons name={icon} size={17} color={danger ? colors.danger : colors.primary} />
      <View>
        <Text style={[styles.summaryValue, danger && styles.summaryValueDanger]}>{value.toLocaleString()}</Text>
        <Text style={styles.summaryLabel}>{label}</Text>
      </View>
    </View>
  );
}

function Section({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.infoList}>{children}</View>
    </View>
  );
}

function InfoRow({ icon, label, value, last = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoDivider]}>
      <View style={styles.infoIcon}><Ionicons name={icon} size={18} color={colors.primary} /></View>
      <View style={styles.infoCopy}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 118 },
  page: {
    width: "100%",
    maxWidth: adminLayout.pageMax,
    alignSelf: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: 26,
  },
  back: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backText: { color: colors.primaryDark, fontSize: 12, fontWeight: "800" },
  identityHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 20,
    paddingVertical: 22,
    paddingHorizontal: 22,
    borderRadius: radius.xl,
    backgroundColor: colors.sky,
    borderWidth: 1,
    borderColor: "#C9E2E8",
    borderLeftWidth: 5,
    borderLeftColor: colors.cyan,
  },
  watchMark: {
    width: 64,
    height: 64,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.blueSoft,
    borderWidth: 1,
    borderColor: "#BEDDE4",
  },
  watchMarkInactive: { backgroundColor: colors.surfaceStrong, borderColor: colors.borderStrong },
  identityCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: colors.blue, fontSize: 9.5, fontWeight: "900", letterSpacing: 1.5 },
  nameLine: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 9, marginTop: 5 },
  watchId: { color: colors.ink, fontSize: 28, lineHeight: 34, fontWeight: "800", letterSpacing: -0.7 },
  paired: { color: colors.muted, fontSize: 10.8, marginTop: 5 },
  summaryRail: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderStrong,
    marginTop: 18,
    paddingVertical: 16,
    overflow: "hidden",
  },
  summaryItem: { flex: 0.72, minWidth: 100, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 14, borderRightWidth: 1, borderRightColor: colors.border },
  summaryValue: { color: colors.ink, fontSize: 19, fontWeight: "800" },
  summaryValueDanger: { color: colors.danger },
  summaryLabel: { color: colors.muted, fontSize: 10.5, marginTop: 2 },
  summaryTextItem: { flex: 1.55, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14 },
  summaryTextCopy: { flex: 1, minWidth: 0 },
  summaryTextValue: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  detailGrid: { marginTop: 18, gap: 18 },
  detailGridWide: { flexDirection: "row", alignItems: "stretch", gap: 18 },
  infoColumn: { flex: 1.55, minWidth: 0, gap: 18 },
  statusColumn: {
    flex: 0.85,
    minWidth: 0,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: "#E7DECC",
    borderRadius: radius.xl,
    padding: 20,
  },
  statusColumnWide: { paddingLeft: 20 },
  section: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 20,
    ...shadow.soft,
  },
  sectionEyebrow: { color: colors.blue, fontSize: 9.5, fontWeight: "900", letterSpacing: 1.2 },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: "800", letterSpacing: -0.35, marginTop: 5 },
  infoList: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, marginTop: 12 },
  infoRow: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 13 },
  infoDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  infoIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: "#CCE3D8" },
  infoCopy: { flex: 1 },
  infoLabel: { color: colors.muted, fontSize: 10.5, fontWeight: "700" },
  infoValue: { color: colors.ink, fontSize: 12.8, lineHeight: 18, fontWeight: "700", marginTop: 4 },
  statusDescription: { color: colors.text, fontSize: 12.5, lineHeight: 19, marginTop: 9 },
  statusBoundary: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#CCE3D8",
    padding: 14,
    marginTop: 18,
  },
  statusBoundaryText: { flex: 1, color: colors.text, fontSize: 11.2, lineHeight: 17 },
  statusButton: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: radius.lg, marginTop: 16, paddingHorizontal: 14 },
  activateButton: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: "#B9DCCD" },
  deactivateButton: { backgroundColor: colors.danger },
  statusButtonText: { color: colors.white, fontSize: 12, fontWeight: "800" },
  activateButtonText: { color: colors.primaryDark },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: colors.background },
  stateIcon: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.blueSoft },
  stateIconError: { backgroundColor: colors.dangerSoft },
  stateTitle: { color: colors.ink, fontSize: 16, fontWeight: "800", marginTop: 14, textAlign: "center" },
  stateText: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 6, maxWidth: 420 },
  retryButton: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 17, marginTop: 16, ...shadow.soft },
  retryText: { color: colors.white, fontSize: 12, fontWeight: "800" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.5 },
});
